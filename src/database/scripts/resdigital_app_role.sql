-- Rol de aplicación con privilegios mínimos.
--
-- Motivo: Multi-Tenant-y-Seguridad.md establece, textualmente:
--
--   "Regla no negociable: el rol de base de datos que usa la aplicación nunca
--    debe tener el privilegio BYPASSRLS ni ser SUPERUSER. Si un módulo 'no le
--    funciona' RLS y la solución que se le ocurre es usar un rol con más
--    privilegios, eso es la señal de que el middleware de tenant no se está
--    aplicando bien — hay que arreglar la causa, no saltarse la protección."
--
-- Hoy la aplicación conecta con el rol dueño de las tablas del proyecto
-- Supabase, que en la práctica salta RLS. Todo el aislamiento entre fincas
-- descansa entonces en que el código no se olvide de filtrar por tenant, que es
-- exactamente lo que la bóveda decidió NO hacer.
--
-- PRERREQUISITO DURO: la migración FixMigrationsTableRLS1789740000004 tiene que
-- estar aplicada. Antes de ella, `public.migrations` tenía FORCE RLS sin
-- políticas, así que un rol sin BYPASSRLS no podía ni leerla y `migration:run`
-- fallaba en el arranque.
--
-- Este archivo NO es una migración de TypeORM a propósito: una migración se
-- ejecutaría sola en el próximo `pnpm migration:run` de cualquier compañero y
-- exigiría tener la contraseña dentro del repositorio.
--
-- Uso:
--   psql "<cadena de conexión del rol dueño>" \
--     -v app_password="'<contraseña generada>'" \
--     -f src/database/scripts/resdigital_app_role.sql

\set ON_ERROR_STOP on

-- 1. Crear el rol. Las banderas negativas son el punto del ejercicio.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'resdigital_app') THEN
    EXECUTE format(
      'CREATE ROLE resdigital_app LOGIN PASSWORD %L NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
      :'app_password'
    );
  ELSE
    EXECUTE format('ALTER ROLE resdigital_app PASSWORD %L', :'app_password');
  END IF;
END $$;

ALTER ROLE resdigital_app NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 2. Heredar `authenticated`, que es el rol al que apuntan las políticas RLS.
-- RlsTransactionInterceptor hace `SET LOCAL ROLE authenticated` en cada
-- transacción, y para poder hacerlo el rol de conexión debe ser miembro.
GRANT authenticated TO resdigital_app;

-- 3. Privilegios sobre el esquema de la aplicación.
GRANT USAGE ON SCHEMA public TO resdigital_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resdigital_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resdigital_app;

-- Las tablas que creen las migraciones futuras también.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resdigital_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO resdigital_app;

-- 4. La CLI de migraciones necesita leer y escribir su propia tabla de control,
-- y crear objetos nuevos.
GRANT CREATE ON SCHEMA public TO resdigital_app;
GRANT SELECT, INSERT, DELETE ON public.migrations TO resdigital_app;

-- 5. auth.jwt() lo usan las políticas RLS de tenant, usuario y los catálogos.
GRANT USAGE ON SCHEMA auth TO resdigital_app;
GRANT EXECUTE ON FUNCTION auth.jwt() TO resdigital_app;

-- 6. Verificación. Las dos columnas deben salir en false: esa es la evidencia
-- directa de que se cumple la regla de la bóveda.
SELECT
  rolname,
  rolsuper    AS es_superusuario,
  rolbypassrls AS puede_saltar_rls
FROM pg_roles
WHERE rolname = 'resdigital_app';
