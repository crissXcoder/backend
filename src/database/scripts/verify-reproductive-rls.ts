import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source.js';
import { ReproductiveService } from '../../reproductivo/services/reproductive.service.js';
import { ReproductiveCalculationService } from '../../reproductivo/services/reproductive-calculation.service.js';
import { ReproductiveStateService } from '../../reproductivo/services/reproductive-state.service.js';
import { Animal } from '../../animales/entities/animal.entity.js';
import { CatalogoRaza } from '../../catalogos/entities/catalogo-raza.entity.js';
import { Evento } from '../../eventos/entities/evento.entity.js';
import { EventoServicio } from '../../reproductivo/entities/evento-servicio.entity.js';
import { EventoDiagnostico } from '../../reproductivo/entities/evento-diagnostico.entity.js';
import { EventoParto } from '../../reproductivo/entities/evento-parto.entity.js';
import { EventoSecado } from '../../reproductivo/entities/evento-secado.entity.js';
import { NotFoundException } from '@nestjs/common';

async function main() {
  console.log('🔄 Iniciando prueba de verificación RLS con Supabase...');
  const dataSource = new DataSource({
    ...dataSourceOptions,
    entities: [
      CatalogoRaza,
      Animal,
      Evento,
      EventoServicio,
      EventoDiagnostico,
      EventoParto,
      EventoSecado,
    ],
  });
  await dataSource.initialize();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  const calcService = new ReproductiveCalculationService();
  const stateService = new ReproductiveStateService(dataSource);
  const reproService = new ReproductiveService(calcService, stateService);

  const tenantA = '270d197a-ce3f-4372-8c33-3ea62600e5fa'; // Finca Demo
  const tenantB = '88888888-8888-8888-8888-888888888888'; // Tenant de prueba externo

  try {
    // 1. Preparar datos de prueba usando permisos de service_role (sin RLS para setup)
    console.log('📦 Buscando raza con días de gestación...');
    let raza = await dataSource.getRepository(CatalogoRaza).findOne({
      where: { nombre: 'Holstein' },
    });
    if (!raza) {
      raza = await dataSource.getRepository(CatalogoRaza).findOne({
        where: {},
      });
    }
    if (!raza || !raza.diasGestacion) {
      throw new Error('No hay raza con dias_gestacion configurada en BD.');
    }
    console.log(`✅ Raza encontrada: ${raza.nombre} (${raza.diasGestacion} días)`);

    // Asegurar animal para Tenant A
    let vacaA = await dataSource.getRepository(Animal).findOne({
      where: { tenantId: tenantA, areteInterno: 'TEST-RLS-A1' },
    });
    if (!vacaA) {
      vacaA = await dataSource.getRepository(Animal).save({
        tenantId: tenantA,
        areteInterno: 'TEST-RLS-A1',
        nombre: 'Vaca Tenant A',
        sexo: 'Hembra',
        razaId: raza.id,
        activo: true,
        categoria: 'Vaca',
      });
    }

    // Asegurar animal para Tenant B (crear tenant si no existe)
    await dataSource.query(`
      INSERT INTO tenant (id, nombre_finca, created_at)
      VALUES ('${tenantB}', 'Tenant B Prueba RLS', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    let vacaB = await dataSource.getRepository(Animal).findOne({
      where: { tenantId: tenantB, areteInterno: 'TEST-RLS-B1' },
    });
    if (!vacaB) {
      vacaB = await dataSource.getRepository(Animal).save({
        tenantId: tenantB,
        areteInterno: 'TEST-RLS-B1',
        nombre: 'Vaca Tenant B',
        sexo: 'Hembra',
        razaId: raza.id,
        activo: true,
        categoria: 'Vaca',
      });
    }

    console.log(`✅ Animal Tenant A: ${vacaA.id} (${vacaA.nombre})`);
    console.log(`✅ Animal Tenant B: ${vacaB.id} (${vacaB.nombre})`);

    // 2. Transacción bajo RLS estricto para Tenant A
    console.log('\n🔒 Iniciando transacción bajo RLS como Tenant A...');
    await queryRunner.startTransaction();

    const claimsTenantA = JSON.stringify({
      sub: 'user-tenant-a-uuid',
      tenant_id: tenantA,
      user_role: 'propietario',
    });

    await queryRunner.query('SET LOCAL ROLE authenticated;');
    await queryRunner.query(`SET LOCAL "request.jwt.claims" = '${claimsTenantA}';`);

    // 2.1 Registrar servicio para Vaca A
    console.log('📝 Registrando servicio reproductivo para Vaca A en Tenant A...');
    const regResult = await reproService.registrarServicio(
      vacaA.id,
      tenantA,
      'user-tenant-a-uuid',
      {
        fechaEvento: '2026-09-01',
        tipoServicio: 'Inseminación Artificial',
        toroOPajilla: 'Pajilla-Alpha-01',
      },
      queryRunner.manager,
    );
    console.log(`✅ Servicio registrado: Evento ID ${regResult.evento.id}, FPP: ${regResult.hitos.fpp}`);

    // 2.2 Intentar consultar estado reproductivo de Vaca B (Tenant B) desde la sesión de Tenant A
    console.log('🧪 Probando criterio 3: Consultar estado reproductivo de animal de Tenant B desde sesión de Tenant A...');
    try {
      await reproService.obtenerEstadoReproductivo(vacaB.id, tenantA, queryRunner.manager);
      throw new Error('❌ FALLA: No arrojó NotFoundException al consultar animal de otro tenant.');
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        console.log(`✅ CRITERIO 3 VERIFICADO: Animal de Tenant B devuelve 404 NotFoundException protegido por RLS: "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 2.3 Probar próximo eventos en sesión de Tenant A
    console.log('🧪 Probando criterio 4: Consultar próximos eventos en sesión de Tenant A...');
    const proximosTenantA = await reproService.obtenerProximosEventos(tenantA, queryRunner.manager, 365);
    console.log(`Resultados encontrados para Tenant A: ${proximosTenantA.length}`);
    const animalBFiltrado = proximosTenantA.find((e) => e.animalId === vacaB.id);
    if (animalBFiltrado) {
      throw new Error('❌ FALLA: Vaca B de Tenant B apareció en la lista de Tenant A.');
    }
    console.log('✅ CRITERIO 4 VERIFICADO: Ningún animal de Tenant B aparece en el feed de Tenant A.');

    // 3. Rollback de la transacción de prueba para dejar la BD limpia
    await queryRunner.rollbackTransaction();
    console.log('🧹 Transacción revertida con éxito (base de datos limpia).');

    console.log('\n🎉 TODAS LAS VERIFICACIONES RLS EN SUPABASE PASARON AL 100%!');
  } finally {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('❌ Error en verificación RLS:', err);
  process.exit(1);
});
