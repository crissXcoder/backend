-- Bootstrap de una base Postgres local para verificar la cadena de migraciones.
--
-- Problema que resuelve: el esquema de ResDigital asume el entorno de Supabase.
-- Varias migraciones referencian `auth.users`, llaman a `auth.jwt()` y crean
-- políticas `TO authenticated` / `TO supabase_auth_admin`. Nada de eso existe en
-- un Postgres recién instalado, así que `pnpm migration:run` falla por razones
-- que no tienen que ver con las migraciones.
--
-- Este script crea el mínimo andamiaje para que la cadena corra en limpio y se
-- pueda comprobar que es replayable. NO reproduce Supabase: no hay GoTrue, no
-- hay Storage, no hay PostgREST. Solo sirve para validar migraciones.
--
-- Uso:
--   docker run -d --name resdigital-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15
--   psql postgresql://postgres:test@localhost:5433/postgres -f src/database/scripts/bootstrap-local.sql
--   pnpm build
--   DATABASE_URL=postgresql://postgres:test@localhost:5433/postgres pnpm migration:run

-- 1. Extensiones que usan las migraciones
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4()

-- 2. Roles de Supabase. NOLOGIN: acá solo hacen falta como destinatarios de las
-- políticas RLS, nadie se conecta con ellos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 3. Esquema `auth` mínimo.
CREATE SCHEMA IF NOT EXISTS auth;

-- `usuario.id` tiene FK contra auth.users(id).
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT
);

-- Stub de auth.jwt(). En Supabase esta función lee los claims del JWT que
-- PostgREST deja en el parámetro de sesión `request.jwt.claims`. La versión real
-- hace lo mismo, así que las políticas se comportan igual mientras el cliente
-- fije ese parámetro — que es exactamente lo que hace RlsTransactionInterceptor.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

-- 4. Privilegios por defecto para las tablas que creen las migraciones, de modo
-- que las políticas `TO authenticated` tengan efecto real y no queden bloqueadas
-- antes por falta de GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
