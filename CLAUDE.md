Este es el proyecto ResDigital (plataforma de trazabilidad ganadera, ver bóveda de Obsidian
conectada en esta sesión con --add-dir). Estoy construyendo MOD-00 (Auth + Tenant), el módulo
base del que dependen todos los demás.

Contexto obligatorio a leer de la bóveda antes de escribir código:
- 02-Arquitectura/Stack-Tecnico-Oficial.md
- 05-Modulos/MOD-00-Auth-y-Tenant.md
- 02-Arquitectura/Multi-Tenant-y-Seguridad.md
- 02-Arquitectura/Decisiones-de-Arquitectura-ADR.md (ADR-001, ADR-002, ADR-007)

Patrón de referencia a replicar (ya probado en producción en otro proyecto mío, Energisa):
autenticación 100% delegada a Supabase Auth (nunca hasheo contraseñas propio, nunca login
propio), backend NestJS que solo verifica JWT contra JWKS (librería `jose`, ES256) y aplica
autorización (roles) + Row Level Security sobre PostgreSQL. La diferencia de dominio: acá el
tenant es una "finca" (no una "empresa"), y los roles son propietario/administrador/peon/
veterinario (no admin/vendedor/cliente).

Stack: NestJS 11 + TypeORM (solo migraciones, nunca synchronize:true) + Supabase (Postgres+Auth)
+ Next.js 15 App Router + TanStack Query/Form + Tailwind v4 + shadcn/ui + Zod + pnpm.

Regla de oro: nunca implementes login/registro/contraseñas propias. Todo pasa por el SDK de
Supabase Auth. NestJS nunca ve una contraseña en texto plano ni un hash.