import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source.js';
import { ReproductiveService } from '../services/reproductive.service.js';
import { ReproductiveCalculationService } from '../services/reproductive-calculation.service.js';
import { ReproductiveStateService } from '../services/reproductive-state.service.js';
import { Animal } from '../../animales/entities/animal.entity.js';
import { CatalogoRaza } from '../../catalogos/entities/catalogo-raza.entity.js';
import { Evento } from '../../eventos/entities/evento.entity.js';
import { EventoServicio } from '../entities/evento-servicio.entity.js';
import { EventoDiagnostico } from '../entities/evento-diagnostico.entity.js';
import { EventoParto } from '../entities/evento-parto.entity.js';
import { EventoSecado } from '../entities/evento-secado.entity.js';

describe('Test End-to-End Flujo Reproductivo Completo (Base Real Supabase)', () => {
  let dataSource: DataSource;
  let reproService: ReproductiveService;

  const tenantId = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
  const userId = 'c2ddf521-f85a-4752-a9cd-803e4354cac8'; // Usuario real de la BD

  let animalId: string;
  let razaGestacionDias: number;
  const createdEventoIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
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

    const calcService = new ReproductiveCalculationService();
    const stateService = new ReproductiveStateService(dataSource);
    reproService = new ReproductiveService(calcService, stateService);

    // 1. Crear tenant de prueba
    await dataSource.query(`
      INSERT INTO tenant (id, nombre_finca, created_at)
      VALUES ('${tenantId}', 'TEST E2E Finca Reproductiva', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Obtener una raza real con días de gestación
    const raza = await dataSource.getRepository(CatalogoRaza).findOne({ where: {} });
    if (!raza || !raza.diasGestacion) {
      throw new Error('Se requiere una raza con diasGestacion para el test E2E.');
    }
    razaGestacionDias = raza.diasGestacion;

    // 3. Crear animal hembra de prueba
    const animalRepo = dataSource.getRepository(Animal);
    const animal = await animalRepo.save({
      tenantId,
      areteInterno: 'TEST-E2E-VACA-01',
      nombre: 'Vaca Flujo E2E',
      sexo: 'Hembra',
      razaId: raza.id,
      categoria: 'Vaca',
      activo: true,
    });
    animalId = animal.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      // Limpieza ordenada respetando FK RESTRICT
      if (createdEventoIds.length > 0) {
        await dataSource.query(`
          DELETE FROM evento_diagnostico WHERE evento_servicio_id = ANY($1::uuid[]) OR evento_id = ANY($1::uuid[])
        `, [createdEventoIds]);
        await dataSource.query(`
          DELETE FROM evento_parto WHERE evento_servicio_id = ANY($1::uuid[]) OR evento_id = ANY($1::uuid[])
        `, [createdEventoIds]);
        await dataSource.query(`
          DELETE FROM evento_secado WHERE evento_id = ANY($1::uuid[])
        `, [createdEventoIds]);
        await dataSource.query(`
          DELETE FROM evento_servicio WHERE evento_id = ANY($1::uuid[])
        `, [createdEventoIds]);
        await dataSource.query(`
          DELETE FROM evento WHERE id = ANY($1::uuid[])
        `, [createdEventoIds]);
      }
      await dataSource.query(
        `DELETE FROM animal WHERE arete_interno = 'TEST-E2E-VACA-01'`,
      );
      await dataSource.query(`DELETE FROM tenant WHERE id = '${tenantId}'`);
      await dataSource.destroy();
    }
  });

  it('Flujo E2E Completo: Vacía -> Servicio (Servida) -> Diagnóstico (Preñada) -> Secado (En Secado) -> Parto (Vacía)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Configurar sesión RLS
      await queryRunner.startTransaction();
      const claims = JSON.stringify({
        sub: userId,
        tenant_id: tenantId,
        user_role: 'propietario',
      });
      await queryRunner.query('SET LOCAL ROLE authenticated;');
      await queryRunner.query(`SET LOCAL "request.jwt.claims" = '${claims}';`);
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);

      // -------------------------------------------------------------
      // PASO 0: Estado inicial antes de cualquier evento
      // -------------------------------------------------------------
      const estadoInicial = await reproService.obtenerEstadoReproductivo(
        animalId,
        tenantId,
        queryRunner.manager,
      );
      expect(estadoInicial.estadoActual).toBe('Vacía');
      expect(estadoInicial.servicioActivo).toBeUndefined();

      // -------------------------------------------------------------
      // PASO 1: Registrar Servicio Reproductivo
      // -------------------------------------------------------------
      const fechaServicio = '2026-03-01';
      const servicioRes = await reproService.registrarServicio(
        animalId,
        tenantId,
        userId,
        {
          fechaEvento: fechaServicio,
          tipoServicio: 'Inseminación Artificial',
          toroOPajilla: 'Titan-Pajilla-E2E',
          responsable: 'Dr. Roberto',
        },
        queryRunner.manager,
      );
      createdEventoIds.push(servicioRes.evento.id);

      // Confirmar estado "Servida"
      const estadoServida = await reproService.obtenerEstadoReproductivo(
        animalId,
        tenantId,
        queryRunner.manager,
      );
      expect(estadoServida.estadoActual).toBe('Servida');
      expect(estadoServida.servicioActivo).toBeDefined();
      expect(estadoServida.servicioActivo?.toroOPajilla).toBe('Titan-Pajilla-E2E');
      expect(estadoServida.servicioActivo?.fpp).toBe(servicioRes.hitos.fpp);

      // -------------------------------------------------------------
      // PASO 2: Registrar Diagnóstico Positivo (Preñada)
      // -------------------------------------------------------------
      const fechaDiagnostico = servicioRes.hitos.palpacionFecha;
      const diagRes = await reproService.registrarDiagnostico(
        animalId,
        tenantId,
        userId,
        {
          fechaEvento: fechaDiagnostico,
          eventoServicioId: servicioRes.evento.id,
          metodo: 'Palpación',
          resultado: 'Preñada',
          notas: 'Palpación positiva, preñez confirmada',
        },
        queryRunner.manager,
      );
      createdEventoIds.push(diagRes.evento.id);

      // Confirmar estado "Preñada" con la FPP correcta
      const estadoPreñada = await reproService.obtenerEstadoReproductivo(
        animalId,
        tenantId,
        queryRunner.manager,
      );
      expect(estadoPreñada.estadoActual).toBe('Preñada');
      expect(estadoPreñada.servicioActivo?.fpp).toBe(servicioRes.hitos.fpp);
      expect(estadoPreñada.ultimoDiagnostico?.resultado).toBe('Preñada');

      // -------------------------------------------------------------
      // PASO 3: Registrar Secado Real
      // -------------------------------------------------------------
      const fechaSecado = servicioRes.hitos.secadoFecha;
      const secadoRes = await reproService.registrarSecado(
        animalId,
        tenantId,
        userId,
        {
          fechaEvento: fechaSecado,
          notas: 'Infusión de secado intramamaria',
        },
        queryRunner.manager,
      );
      createdEventoIds.push(secadoRes.evento.id);

      // Confirmar estado "En Secado"
      const estadoSecado = await reproService.obtenerEstadoReproductivo(
        animalId,
        tenantId,
        queryRunner.manager,
      );
      expect(estadoSecado.estadoActual).toBe('En Secado');
      expect(estadoSecado.servicioActivo).toBeDefined();

      // -------------------------------------------------------------
      // PASO 4: Registrar Parto
      // -------------------------------------------------------------
      const fechaParto = servicioRes.hitos.fpp;
      const partoRes = await reproService.registrarParto(
        animalId,
        tenantId,
        userId,
        {
          fechaEvento: fechaParto,
          eventoServicioId: servicioRes.evento.id,
          facilidadParto: 'Normal (Eutócico)',
          observaciones: 'Parto exitoso a término, cría hembra nacida vigorosa',
        },
        queryRunner.manager,
      );
      createdEventoIds.push(partoRes.evento.id);

      // Confirmar que culmina el ciclo y vuelve a "Vacía"
      const estadoFinal = await reproService.obtenerEstadoReproductivo(
        animalId,
        tenantId,
        queryRunner.manager,
      );
      expect(estadoFinal.estadoActual).toBe('Vacía');
      expect(estadoFinal.servicioActivo).toBeUndefined();
      expect(estadoFinal.ultimoParto?.facilidadParto).toBe('Normal (Eutócico)');

      await queryRunner.commitTransaction();
    } finally {
      await queryRunner.release();
    }
  });
});
