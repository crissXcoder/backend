# Runbook 02 — Rol de base de datos con privilegios mínimos

**Estado:** pendiente de ejecución · **Responsable:** Cristhian (MOD-00 Auth/Tenant)
**Cuándo:** después de que la suite de pruebas esté en verde y el runbook 01 esté cerrado.

---

## 1. El problema

`02-Arquitectura/Multi-Tenant-y-Seguridad.md` dice, textualmente:

> **Regla no negociable:** el rol de base de datos que usa la aplicación **nunca** debe
> tener el privilegio `BYPASSRLS` ni ser `SUPERUSER`. Si un módulo "no le funciona" RLS y
> la solución que se le ocurre es usar un rol con más privilegios, eso es la señal de que
> el middleware de tenant no se está aplicando bien — hay que arreglar la causa, no
> saltarse la protección.

Hoy la aplicación conecta con el rol dueño de las tablas del proyecto Supabase. Ese rol
salta Row Level Security. Es decir: todo el aislamiento entre fincas descansa en que el
código nunca se olvide de filtrar por `tenant_id`, que es justamente lo que la bóveda
decidió **no** hacer. RLS existe como red de seguridad para cuando el código falla, y
ahora mismo esa red está desconectada.

Durante la auditoría esto no era un detalle teórico: `CatalogosService.findAllRazas()`
consultaba sin ningún filtro de tenant. Con RLS realmente activo habría devuelto solo lo
que corresponde; con el rol actual devolvía las razas privadas de todas las fincas.

## 2. Prerrequisito

La migración `FixMigrationsTableRLS1789740000004` **debe estar aplicada**.

Antes de ella, `public.migrations` tenía `FORCE ROW LEVEL SECURITY` sin ninguna política,
lo que la vuelve ilegible incluso para el dueño de la tabla. Con el rol actual eso pasaba
desapercibido porque tiene `BYPASSRLS`; con el rol nuevo, `pnpm migration:run` fallaría en
el primer paso.

```bash
pnpm migration:show | grep FixMigrationsTableRLS
```

## 3. Crear el rol

1. Generar una contraseña larga y aleatoria, y guardarla en el gestor de contraseñas.

2. Aplicar el script con la conexión actual (la del rol dueño):

   ```bash
   psql "$DATABASE_URL" \
     -v app_password="'<la contraseña generada>'" \
     -f src/database/scripts/resdigital_app_role.sql
   ```

   La contraseña se pasa como variable de `psql`, nunca escrita dentro del archivo.

3. La última consulta del script imprime la verificación. Ambas columnas deben decir
   `false`:

   ```
       rolname     | es_superusuario | puede_saltar_rls
   ----------------+-----------------+------------------
    resdigital_app | f               | f
   ```

   Esa salida es la evidencia concreta de que se cumple la regla de la bóveda. Vale la
   pena guardarla como captura para la defensa del proyecto.

## 4. Cambiar la conexión de la aplicación

Reemplazar el usuario y la contraseña de `DATABASE_URL` en `backend/.env` por los del rol
nuevo, manteniendo el host, el puerto y la base:

```
DATABASE_URL=postgresql://resdigital_app:<contraseña>@<host>:5432/postgres
```

## 5. Verificar

```bash
pnpm migration:show     # debe listar las migraciones sin error
pnpm start:dev          # debe arrancar y conectar
```

Luego, con sesión iniciada en la aplicación:

- `GET /animales` devuelve los animales de la finca del usuario.
- `GET /catalogos/razas` devuelve las razas globales más las propias, y ninguna de otra
  finca.
- Con dos usuarios de fincas distintas, ninguno ve datos del otro.

## 6. Qué se va a romper, y por qué está bien

Cualquier script que se conecte directo a la base y **no** establezca el contexto de
tenant va a empezar a ver cero filas. Eso no es un fallo: es RLS funcionando.

Los afectados son:

| Qué | Cómo se adapta |
|---|---|
| `pnpm seed:dev`, `pnpm seed:sanitary` | Operan sobre varias fincas a la vez, así que deben seguir usando la conexión del rol dueño, no la de la aplicación. |
| Tests de integración (`pnpm test:integration`) | Ya hacen `SET LOCAL ROLE authenticated` y fijan `request.jwt.claims` + `app.current_tenant_id` en cada transacción. Deberían seguir funcionando tal cual. |
| Consultas manuales desde el SQL Editor del Dashboard | Corren como el rol dueño; no cambian. |

Si algo deja de funcionar y la tentación es devolverle privilegios al rol, ese es
exactamente el caso que la bóveda anticipa: la causa está en que falta fijar el contexto
de tenant, no en el rol.

## 7. Revertir

Si hace falta volver atrás, basta con restaurar el `DATABASE_URL` anterior en `.env`. El
rol `resdigital_app` puede quedar creado sin efecto alguno.

---

## Checklist

- [ ] `FixMigrationsTableRLS1789740000004` aplicada
- [ ] Contraseña generada y guardada en el gestor de contraseñas
- [ ] Script aplicado y verificación con `rolsuper = false` y `rolbypassrls = false`
- [ ] `DATABASE_URL` actualizada
- [ ] `pnpm migration:show` y `pnpm start:dev` funcionan
- [ ] Aislamiento entre dos fincas verificado desde la aplicación
- [ ] Captura de la verificación guardada para la defensa
