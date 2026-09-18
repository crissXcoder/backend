/**
 * Guarda de entorno para los tests de integración.
 *
 * Estos specs escriben y borran filas en la base de datos real configurada en
 * `DATABASE_URL`, que hoy es la misma que usa la aplicación. Correrlos por
 * accidente destruye datos del equipo, así que exigen una opción explícita.
 */
export default function setup(): void {
  // Se comprueba ANTES de cargar `.env`: la autorización tiene que venir del
  // comando, no de un archivo que cualquiera tenga configurado sin saberlo.
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== 'true') {
    throw new Error(
      'Los tests de integración escriben en la base de datos real.\n' +
        'Para ejecutarlos a propósito: ALLOW_DB_INTEGRATION_TESTS=true pnpm test:integration',
    );
  }

  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile?.('.env');
    } catch (error) {
      throw new Error(
        `No se pudo cargar .env para los tests de integración: ${(error as Error).message}`,
      );
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL. Los tests de integración necesitan una conexión real.',
    );
  }
}
