import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source.js';
import { Potrero } from '../entities/potrero.entity.js';
import { Animal } from '../../animales/entities/animal.entity.js';
import { CatalogoRaza } from '../../catalogos/entities/catalogo-raza.entity.js';

describe('Test de Integración Real RLS — MOD-05 Potreros (Base Real Supabase)', () => {
  let dataSource: DataSource;

  const tenantA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const userTenantA = 'c2ddf521-f85a-4752-a9cd-803e4354cac8';
  const userTenantB = '66be99b7-1f4e-4f84-97b6-61558e4cb345';

  let potreroAId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...dataSourceOptions,
      entities: [Potrero, Animal, CatalogoRaza],
    });
    await dataSource.initialize();

    await dataSource.query(`
      INSERT INTO tenant (id, nombre_finca, created_at)
      VALUES 
        ('${tenantA}', 'TEST RLS Finca A', NOW()),
        ('${tenantB}', 'TEST RLS Finca B', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (potreroAId) {
        await dataSource.query(`DELETE FROM potrero WHERE id = $1`, [potreroAId]);
      }
      const tablesToClean = ['evento_servicio', 'evento_parto', 'evento_secado', 'evento_diagnostico', 'evento_tratamiento', 'evento_pesaje'];
      for (const table of tablesToClean) {
        try {
          await dataSource.query(`DELETE FROM ${table}`);
        } catch (e) {}
      }
      await dataSource.query(`DELETE FROM evento WHERE tenant_id IN ('${tenantA}', '${tenantB}')`);
      await dataSource.query(
        `DELETE FROM animal WHERE tenant_id IN ('${tenantA}', '${tenantB}')`,
      );
      await dataSource.query(
        `DELETE FROM tenant WHERE id IN ('${tenantA}', '${tenantB}')`,
      );
      await dataSource.destroy();
    }
  });

  it('CRITERIO RLS 1: pg_class confirma relrowsecurity = true y relforcerowsecurity = true en potrero', async () => {
    const rows = await dataSource.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE relname = 'potrero';
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0].relrowsecurity).toBe(true);
    expect(rows[0].relforcerowsecurity).toBe(true);
  });

  it('CRITERIO RLS 2: pg_policies confirma política EXISTS con aislamiento por tenant_id', async () => {
    const policies = await dataSource.query(`
      SELECT tablename, policyname, qual 
      FROM pg_policies 
      WHERE tablename = 'potrero';
    `);

    expect(policies.length).toBeGreaterThan(0);
    const policy = policies[0];
    expect(policy.policyname).toBe('potrero_isolation_policy');
    expect(policy.qual).toContain('tenant_id');
  });

  it('CRITERIO RLS 3: Aislamiento estricto entre Tenant A y Tenant B en base real', async () => {
    const queryRunnerA = dataSource.createQueryRunner();
    await queryRunnerA.connect();

    try {
      await queryRunnerA.startTransaction();
      const claimsA = JSON.stringify({
        sub: userTenantA,
        tenant_id: tenantA,
        user_role: 'propietario',
      });
      await queryRunnerA.query('SET LOCAL ROLE authenticated;');
      await queryRunnerA.query(`SET LOCAL "request.jwt.claims" = '${claimsA}';`);
      await queryRunnerA.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantA]);

      const insertPotrero = await queryRunnerA.query(`
        INSERT INTO potrero (tenant_id, nombre, area_ha, capacidad_recomendada_ua_ha, dias_descanso_recomendados)
        VALUES ($1, 'Potrero A Test RLS', 10.5, 2.0, 30)
        RETURNING id;
      `, [tenantA]);
      potreroAId = insertPotrero[0].id;

      const lecturaTenantA = await queryRunnerA.query(`
        SELECT * FROM potrero WHERE id = $1;
      `, [potreroAId]);
      expect(lecturaTenantA).toHaveLength(1);
      expect(lecturaTenantA[0].nombre).toBe('Potrero A Test RLS');

      await queryRunnerA.commitTransaction();
    } finally {
      await queryRunnerA.release();
    }

    const queryRunnerB = dataSource.createQueryRunner();
    await queryRunnerB.connect();

    try {
      await queryRunnerB.startTransaction();
      const claimsB = JSON.stringify({
        sub: userTenantB,
        tenant_id: tenantB,
        user_role: 'propietario',
      });
      await queryRunnerB.query('SET LOCAL ROLE authenticated;');
      await queryRunnerB.query(`SET LOCAL "request.jwt.claims" = '${claimsB}';`);
      await queryRunnerB.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantB]);

      // Intento de LECTURA: Tenant B intenta leer potrero de Tenant A sin WHERE
      const lecturaTodosTenantB = await queryRunnerB.query(`
        SELECT * FROM potrero WHERE id = $1;
      `, [potreroAId]);
      expect(lecturaTodosTenantB).toHaveLength(0); // Bloqueado por RLS

      // Intento de MODIFICACIÓN
      const updateTenantB = await queryRunnerB.query(`
        UPDATE potrero 
        SET nombre = 'Hackeado por B' 
        WHERE id = $1;
      `, [potreroAId]);
      expect(updateTenantB[1] ?? 0).toBe(0);

      // Intento de ELIMINACIÓN
      const deleteTenantB = await queryRunnerB.query(`
        DELETE FROM potrero WHERE id = $1;
      `, [potreroAId]);
      expect(deleteTenantB[1] ?? 0).toBe(0);

      await queryRunnerB.rollbackTransaction();
    } finally {
      await queryRunnerB.release();
    }
  });
});
