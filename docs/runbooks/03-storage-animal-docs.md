# Runbook 03 — Bucket de documentos `animal_docs`

**Estado:** parcialmente automatizado · **Responsable:** Cristhian, coordinado con quien toque el frontend
**Riesgo:** este es el cambio con mayor radio de impacto de toda la remediación.

---

## 1. Qué pasó

Un script suelto, `fix-rls.mjs` (ya eliminado del repositorio), se ejecutó a mano contra
la base y creó cuatro políticas sobre `storage.objects`:

```sql
CREATE POLICY "Allow public uploads animal_docs" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'animal_docs');
CREATE POLICY "Allow public read animal_docs"    ON storage.objects FOR SELECT TO public USING      (bucket_id = 'animal_docs');
CREATE POLICY "Allow public update animal_docs"  ON storage.objects FOR UPDATE TO public USING      (bucket_id = 'animal_docs');
CREATE POLICY "Allow public delete animal_docs"  ON storage.objects FOR DELETE TO public USING      (bucket_id = 'animal_docs');
```

Dos problemas:

1. **`TO public`.** En PostgreSQL `public` incluye al rol `anon`, que es con el que
   responde PostgREST usando la anon key. Esa clave es pública por diseño: va compilada
   dentro del bundle del frontend.
2. **Ningún filtro de tenant.** La única condición es `bucket_id = 'animal_docs'`.

Combinados: cualquiera con la anon key podía leer, sobrescribir y **borrar** los
documentos de todas las fincas del sistema.

Además, otro script (`check-buckets.mjs`, también eliminado) dejó el bucket marcado como
`public: true`, así que los archivos son accesibles por URL directa sin ninguna sesión.

Como todo esto se aplicó fuera de TypeORM, no quedó ni migración que lo revirtiera ni
rastro en `public.migrations`: el estado vivía únicamente dentro de la base.

## 2. Lo que ya está resuelto por migración

`RevokeAnimalDocsPublicStoragePolicies1789740000005` elimina las cuatro políticas por su
nombre exacto y crea una que exige sesión autenticada y acota por carpeta:

```sql
CREATE POLICY "animal_docs_tenant_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'animal_docs' AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id'))
  WITH CHECK (bucket_id = 'animal_docs' AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id'));
```

La migración **no** cambia la bandera `public` del bucket. Ese paso es manual y está en la
sección 4, porque rompe el frontend si se hace antes de tiempo.

### Si la migración no tuvo privilegios

`storage.objects` pertenece a `supabase_storage_admin`. Según con qué rol corran las
migraciones, puede no haber permiso para alterarla. La migración está envuelta en un
manejador de excepciones: no aborta, solo emite un `NOTICE`.

Para comprobarlo:

```sql
SELECT policyname, roles, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (policyname LIKE '%animal_docs%' OR policyname = 'animal_docs_tenant_rw');
```

Si siguen apareciendo las cuatro políticas `Allow public ...`, pegar este bloque en el
**SQL Editor del Dashboard de Supabase**, que sí corre con privilegios suficientes:

```sql
DROP POLICY IF EXISTS "Allow public uploads animal_docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read animal_docs"    ON storage.objects;
DROP POLICY IF EXISTS "Allow public update animal_docs"  ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete animal_docs"  ON storage.objects;

DROP POLICY IF EXISTS "animal_docs_tenant_rw" ON storage.objects;
CREATE POLICY "animal_docs_tenant_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'animal_docs'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  )
  WITH CHECK (
    bucket_id = 'animal_docs'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );
```

## 3. Precondición sobre la convención de rutas

La política nueva asume que los objetos se guardan como:

```
animal_docs/<tenant_id>/<lo-que-sea>.pdf
```

**Si el frontend no usa esa convención, las subidas van a empezar a fallar.** Antes de dar
por cerrado este runbook hay que verificar cómo se construye el `path` en el `upload()`
del frontend y, si hace falta, anteponerle el `tenant_id`.

Los archivos que ya estén guardados con otra estructura de carpetas dejarán de ser
accesibles para sus propias fincas y habrá que moverlos.

## 4. Pasar el bucket a privado (paso manual, coordinado)

> ⚠️ Con el bucket público, `getPublicUrl()` devuelve una URL que funciona sin sesión.
> Al pasarlo a privado esas URLs devuelven 400 y **todos los documentos dejan de verse en
> la aplicación**. Este es el cambio de mayor radio de impacto del plan.

Orden obligatorio:

1. **Primero el frontend.** Migrar de `getPublicUrl()` a `createSignedUrl(path, expiresIn)`.
   Buscar todos los usos:

   ```bash
   cd ../frontend && grep -rn "getPublicUrl\|animal_docs" --include="*.ts" --include="*.tsx" .
   ```

2. **Desplegar el frontend** y confirmar que los documentos se siguen viendo con el bucket
   todavía público (las URLs firmadas funcionan igual sobre un bucket público).

3. **Recién entonces**, en el Dashboard: **Storage → animal_docs → Settings** y desmarcar
   *Public bucket*.

4. Verificar: subir un documento, verlo, y comprobar que pegar la URL directa en una
   ventana de incógnito ya no funciona.

## 5. Verificación final

```sql
-- No debe quedar ninguna política sobre animal_docs concedida a `public`.
SELECT policyname, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- El bucket no debe estar marcado como público.
SELECT id, name, public FROM storage.buckets WHERE name = 'animal_docs';
```

---

## Checklist

- [ ] Las cuatro políticas `Allow public ... animal_docs` ya no existen
- [ ] Existe `animal_docs_tenant_rw`, `TO authenticated`, con filtro de carpeta por tenant
- [ ] Verificada la convención de rutas `<tenant_id>/<archivo>` en las subidas del frontend
- [ ] Archivos existentes migrados a esa estructura, si hacía falta
- [ ] Frontend migrado a `createSignedUrl()` y desplegado
- [ ] Bucket pasado a privado
- [ ] Documentos visibles dentro de la aplicación y no accesibles por URL directa
