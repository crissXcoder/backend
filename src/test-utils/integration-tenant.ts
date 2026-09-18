import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

/**
 * Utilidades para los tests de integración, que corren contra la base de datos
 * compartida del equipo.
 *
 * Dos reglas que no se negocian acá:
 *  1. Los tenants son aleatorios por corrida. Los UUID fijos hacían que dos
 *     specs distintos se pisaran entre sí.
 *  2. Todo DELETE lleva `WHERE` con el tenant y va parametrizado. Nunca se
 *     borra una tabla entera ni se interpola un id dentro del SQL.
 */

export interface TenantsDePrueba {
  tenantA: string;
  tenantB: string;
}

export function crearTenantsDePrueba(): TenantsDePrueba {
  return { tenantA: randomUUID(), tenantB: randomUUID() };
}

/**
 * Lee los UUID de los usuarios de prueba del entorno.
 *
 * `evento.usuario_id` tiene FK contra `usuario`, que a su vez referencia
 * `auth.users` de Supabase, así que los tests no pueden inventarse un usuario:
 * tienen que apuntar a uno que exista de verdad en la base.
 */
export function obtenerUsuariosDePrueba(): {
  usuarioA: string;
  usuarioB: string;
} | null {
  const usuarioA = process.env.TEST_USER_A_ID;
  const usuarioB = process.env.TEST_USER_B_ID;
  if (!usuarioA || !usuarioB) return null;
  return { usuarioA, usuarioB };
}

export async function insertarTenant(
  dataSource: DataSource,
  tenantId: string,
  nombre = `TEST Finca ${tenantId.slice(0, 8)}`,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO tenant (id, nombre_finca, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO NOTHING;`,
    [tenantId, nombre],
  );
}

export async function insertarTenants(
  dataSource: DataSource,
  tenants: TenantsDePrueba,
): Promise<void> {
  await insertarTenant(
    dataSource,
    tenants.tenantA,
    `TEST Finca A ${tenants.tenantA.slice(0, 8)}`,
  );
  await insertarTenant(
    dataSource,
    tenants.tenantB,
    `TEST Finca B ${tenants.tenantB.slice(0, 8)}`,
  );
}

/**
 * Orden de borrado: de las tablas hoja hacia las raíces, respetando las FK.
 * Las tablas de detalle reproductivo no tienen `tenant_id` propio, así que se
 * acotan por su evento padre.
 */
const DETALLES_REPRODUCTIVOS = [
  'evento_servicio',
  'evento_diagnostico',
  'evento_parto',
  'evento_secado',
];

const TABLAS_CON_TENANT = [
  'pesaje',
  'documento_animal',
  'tratamiento_sanitario',
  'evento',
  'animal',
  'potrero',
  'catalogo_raza',
  'evento_auth',
  'invitacion',
];

async function tablaExiste(
  dataSource: DataSource,
  tabla: string,
): Promise<boolean> {
  const filas: Array<{ existe: string | null }> = await dataSource.query(
    `SELECT to_regclass($1)::text AS existe;`,
    [`public.${tabla}`],
  );
  return filas[0]?.existe != null;
}

export async function limpiarTenants(
  dataSource: DataSource,
  tenantIds: string[],
): Promise<void> {
  if (tenantIds.length === 0) return;

  for (const tabla of DETALLES_REPRODUCTIVOS) {
    if (!(await tablaExiste(dataSource, tabla))) continue;
    await dataSource.query(
      `DELETE FROM ${tabla}
       WHERE evento_id IN (SELECT id FROM evento WHERE tenant_id = ANY($1));`,
      [tenantIds],
    );
  }

  // Romper las autorreferencias de `animal` antes de borrar las filas.
  if (await tablaExiste(dataSource, 'animal')) {
    await dataSource.query(
      `UPDATE animal SET madre_id = NULL, padre_id = NULL, potrero_id = NULL
       WHERE tenant_id = ANY($1);`,
      [tenantIds],
    );
  }

  for (const tabla of TABLAS_CON_TENANT) {
    if (!(await tablaExiste(dataSource, tabla))) continue;
    await dataSource.query(`DELETE FROM ${tabla} WHERE tenant_id = ANY($1);`, [
      tenantIds,
    ]);
  }

  await dataSource.query(`DELETE FROM tenant WHERE id = ANY($1);`, [tenantIds]);
}
