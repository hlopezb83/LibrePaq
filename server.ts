import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { api } from './src/server/api';

const app = new Hono();

app.route('/', api);
app.use('/*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));

const port = Number(process.env.PORT || 3000);
console.log(`🚀 Libre Contpaq Cloud corriendo en http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch
};
