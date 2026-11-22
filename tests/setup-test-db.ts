/**
 * Aislamiento de SQLite por ejecución/worker en `bun test`, evitando bloqueos y
 * contaminación sobre `data/libre-contpaq.sqlite` de desarrollo.
 */
if (!process.env.LIBREPAQ_DB_PATH) {
  process.env.LIBREPAQ_DB_PATH = ':memory:';
}
