# Cambios en módulos que no son míos

**De:** Cristhian · **Fecha:** 17 de setiembre de 2026
**Para:** Danny, Ari y Karla

Haciendo la auditoría del backend aparecieron varios problemas dentro de sus módulos. Los
arreglé junto con los míos para dejar el repositorio entero compilando y con las pruebas en
verde de una sola vez, pero **son sus archivos**, así que acá va el detalle de qué toqué y
por qué. Si algo no les cuadra, díganme y lo revertimos.

Resumen del estado del backend después de estos cambios:

- `tsc --noEmit`: de **95 errores a 0**
- `pnpm lint`: **0 errores**
- `pnpm test`: de **70 a 99 pruebas**, todas en verde

---

## Danny — MOD-01 Hato/Expediente y MOD-05 Potreros

### 1. Fuga de datos entre fincas en el catálogo de razas

`src/catalogos/catalogos.service.ts`

`findAllRazas()` hacía `this.razaRepository.find({ order: { nombre: 'ASC' } })`: sin
filtro de tenant y usando un repositorio global, o sea fuera de la transacción donde se
activa Row Level Security. El resultado es que el endpoint devolvía también las razas
privadas de otras fincas.

Ahora recibe el `EntityManager` de la transacción y filtra explícitamente:
`where: [{ tenantId: IsNull() }, { tenantId }]`, que es el catálogo híbrido
(globales + propias) que define la migración `SecureCatalogoRazaAndMigrations`.

Cambió la firma: `findAllRazas(tenantId, manager)`. El controlador también.

### 2. Comparaciones numéricas contra strings

`src/potreros/potreros.service.ts:97,103`

`area_ha` y `capacidad_recomendada_ua_ha` son `numeric` en Postgres, y TypeORM los
devuelve como **string** para no perder precisión. El cálculo de carga comparaba esos
strings contra números apoyándose en la coerción implícita de JavaScript. Funciona, pero
en silencio y de forma frágil. Agregué `Number.parseFloat()` explícito.

### 3. Borrar un potrero con animales daba error 500

`src/potreros/potreros.service.ts` → `remove()`

La FK `animal.potrero_id` es `ON DELETE NO ACTION`, así que el borrado reventaba contra la
integridad referencial y salía como 500. Ahora cuenta los animales asignados primero y
lanza un `409 Conflict` con un mensaje claro: *"todavía tiene N animal(es) asignado(s).
Movelos a otro potrero primero."*

### 4. Error 400 falso al asignar animales repetidos

`src/potreros/potreros.service.ts` → `asignarAnimales()`

Comparaba `result.affected !== animalIds.length`. Si el cliente mandaba el mismo animal
dos veces, el UPDATE afectaba una sola fila y la comparación fallaba. Ahora compara contra
los ids únicos.

### 5. Fecha en UTC en vez de la hora de la finca

`src/potreros/potreros.service.ts` → `fechaUltimoIngreso`

Usaba `new Date().toISOString().split('T')[0]`, que da el día en UTC. Costa Rica es UTC−6,
así que entre las 6 de la tarde y la medianoche el sistema ya registraba el día siguiente,
y eso corría el cálculo de días de descanso. Ahora usa `hoyEnZona()`, la misma función que
resolvió el mismo problema en el módulo reproductivo.

### 6. DTOs tipados como `any` en el servicio

`src/animales/animales.service.ts`

`findAll`, `create`, `update`, `darDeBaja` y `createDocumento` recibían `any`. El
controlador validaba con DTOs, pero el servicio aceptaba cualquier forma, así que el
tipado de punta a punta quedaba anulado. Cambiados a los DTOs que **ya existían** en
`src/animales/dto/`.

También extraje a un helper los dos bloques idénticos que convertían `''` a `null`
(estaban duplicados en `create` y `update`).

### 7. `sexo` y `categoria` sin catálogo cerrado

`src/animales/dto/create-animal.dto.ts`

Estaban como `@IsString()` pese a que la base tiene `CHECK (sexo IN ('Hembra','Macho'))`.
Un valor inválido pasaba la validación y reventaba contra Postgres como 500. Ahora usan
`@IsIn`.

Para `categoria` definí la lista `CATEGORIAS_ANIMAL`. La saqué de los valores que
`PotrerosService.calcularEstadoPotrero` ya compara para calcular las unidades animal
(`'Vaca'`, `'Toro'`, `'Novillo mayor'`). **Si la lista no es la correcta, corregila**: con
un valor fuera de catálogo el cálculo de carga del potrero daba mal en silencio.

### 8. El cliente podía crear un animal ya dado de baja

`src/animales/dto/create-animal.dto.ts`

El DTO aceptaba `activo?: boolean`. Lo quité: un alta siempre entra activa, y la baja tiene
su propio endpoint con su DTO, que además exige motivo, fecha y tipo.

### 9. Cinco pruebas de potreros que nunca corrieron

`src/potreros/tests/potreros-funcional.integration.spec.ts`

El archivo importaba `../../auth/guards/jwt-auth.guard`, que **no existe en el repositorio**
(el guard se llama `AuthGuard`). Además todos los imports relativos venían sin la extensión
`.js`, que el proyecto necesita por usar ESM con `moduleResolution: nodenext`. El módulo no
resolvía, así que las cinco pruebas fallaban al cargar y nunca se ejecutaron.

---

## Ari — MOD-02 Sanitario

### 10. Los catálogos nunca leyeron la base de datos

`src/sanitary/sanitary.module.ts`

El módulo no registraba `TypeOrmModule.forFeature([Medicamento, Padecimiento])`, y ningún
otro lo hacía. Con `autoLoadEntities: true`, TypeORM solo conoce las entidades que algún
módulo declara, así que cualquier consulta sobre esas dos lanzaba
`EntityMetadataNotFoundError`.

Ese error quedaba atrapado por el `try/catch` del servicio, que respondía **200** con el
catálogo en memoria y UUIDs inventados (`'00000000-0000-0000-0000-000000000001'`). O sea:
`GET /catalogos/medicamentos` y `GET /catalogos/padecimientos` **nunca** leyeron la base, y
como respondían bien, nadie se enteró.

Agregué el `forFeature`.

### 11. Los errores ya no se disfrazan de éxito

`src/sanitary/sanitary.service.ts`

Separé los dos casos que antes se trataban igual:

- **Error de consulta** → se propaga. El filtro global de excepciones lo traduce al código
  HTTP que corresponda.
- **Tabla vacía** → se devuelve el catálogo de referencia con una advertencia en el log,
  porque una finca recién creada todavía no tiene catálogo propio y dejar la pantalla en
  blanco no ayuda. Se resuelve corriendo `pnpm seed:sanitary`.

También pasó a usar el `EntityManager` de la transacción RLS en vez de un `DataSource`
global. Cambiaron las firmas: `getMedicamentos(tenantId, manager)` y
`getPadecimientos(tenantId, manager)`.

### 12. Tratamientos no verificaba la pertenencia del animal

`src/tratamientos/tratamientos.service.ts` → `create()`

Era el único módulo que no buscaba el animal antes de escribir: confiaba solo en la FK y en
RLS. Ahora un `animalId` que no exista o sea de otra finca responde 404 en vez de un error
de base de datos.

---

## Karla — MOD-06 Leche (pesajes)

### 13. Fallo silencioso al registrar un pesaje

`src/pesajes/pesajes.service.ts` → `create()`

Si el animal no existía, el `if (animal)` simplemente no hacía nada: el pesaje se guardaba
igual, sin sincronizar el peso, y la respuesta era 200. Ahora se verifica el animal
**antes** de escribir y responde 404.

### 14. Un peso de 0 kg se ignoraba

Mismo archivo. `if (createDto.pesoActualKg)` es falso cuando el valor es `0`, así que ese
peso no se sincronizaba. Cambiado a una comparación explícita contra `null`/`undefined`.

---

## Los cuatro

### 15. `@Request() req: any` reemplazado por `@CurrentUser()`

18 handlers en `animales`, `potreros`, `tratamientos` y `pesajes` leían `req.user.tenantId`
desde un `any`, sin tipo ni comprobación de nulidad. Si el guard no llegara a correr, el
fallo sería un `TypeError` en tiempo de ejecución en vez de un 401 limpio.

Ahora usan `@CurrentUser() user: AuthenticatedUser`, el decorador que ya existía en
`src/auth/decorators/`. Con esto el código de producción quedó en **0 usos de `any`**.

### 16. La regla `no-explicit-any` del linter estaba apagada

`.oxlintrc.json` tenía `"typescript/no-explicit-any": "off"`. La puse en `error` para
código de producción y en `warn` para los archivos de prueba, donde los mocks a veces lo
necesitan de verdad. El lint pasa en verde.

---

## Un hallazgo de arquitectura que NO toqué

`src/eventos/entities/evento.entity.ts` declara nueve tipos de evento (`TRATAMIENTO`,
`PESAJE`, `PRODUCCION_LECHE`, `MOVIMIENTO`, `MUERTE`, entre otros), pero los módulos
`tratamientos`, `pesajes` y `sanitary` escriben en **sus propias tablas**, nunca en
`evento`.

`Patron-Evento-Estado-Alerta.md` es explícita:

> Todo módulo que registre algo que le pasa a un animal (Sanitario, Reproductivo, y a
> futuro Leche/Potreros) debe seguir este patrón exacto. **No hay excepciones ni "atajos
> por ahora".**

Y `Definicion-de-Terminado.md` lo repite: *"Si el módulo registra eventos, sigue el patrón
de Patron-Evento-Estado-Alerta sin excepciones."*

Hoy el patrón está aplicado **solo en reproductivo**.

No lo toqué porque migrar esos módulos es un cambio de modelo de datos, no un arreglo, y
excede lo que corresponde que yo decida por mi cuenta. Pero hay que hablarlo entre los
cuatro, porque afecta directamente el puntaje de "Diseño técnico y arquitectura" (20 pts) y
es justo el tipo de decisión que el profesor va a preguntar en la defensa. Sugiero que lo
resolvamos en el próximo seguimiento y que quede registrado en
`Decisiones-de-Arquitectura-ADR.md`, sea cual sea la decisión.

---

## Lo que necesitan hacer ustedes

1. `git pull` en `backend`.
2. `pnpm install` — se agregaron `helmet`, `express-rate-limit`, `husky` y `lint-staged`.
3. Actualizar su `.env` con las credenciales nuevas (les paso por privado; ver el runbook
   de rotación).
4. **Nunca más un script con una cadena de conexión adentro.** Todo lo que toque la base va
   en `src/database/scripts/` y lee de `process.env`. Hay un hook de pre-commit y una
   verificación en CI que bloquean los commits con credenciales.
5. `pnpm test` ahora corre **solo** las pruebas unitarias. Las de integración escriben en
   la base compartida y requieren pedirlo a propósito:
   `ALLOW_DB_INTEGRATION_TESTS=true pnpm test:integration`.
