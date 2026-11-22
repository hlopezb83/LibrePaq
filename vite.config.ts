process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function honoApiPlugin(): Plugin {
  let apiInstance: { fetch: (req: Request) => Promise<Response> } | null = null;

  return {
    name: 'libre-contpaq-hono-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }
        try {
          if (!apiInstance) {
            const { api } = await import('./src/server/api');
            apiInstance = api;
          }
          const protocol = 'http';
          const host = req.headers.host || 'localhost:3000';
          const url = new URL(req.url, `${protocol}://${host}`);

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const v of value) headers.append(key, v);
            } else if (typeof value === 'string') {
              headers.set(key, value);
            }
          }

          let body: BodyInit | undefined = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            body = Buffer.concat(chunks);
          }

          const webReq = new Request(url.toString(), {
            method: req.method,
            headers,
            body
          });

          const webRes = await apiInstance.fetch(webReq);

          res.statusCode = webRes.status;
          webRes.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          const arrayBuffer = await webRes.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), honoApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('fast-xml-parser') || id.includes('fflate')) {
              return 'vendor-xml-utils';
            }
          }
        }
      }
    }
  }
});
