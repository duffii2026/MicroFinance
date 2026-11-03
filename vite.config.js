import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, extname } from 'node:path';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';

/* The 19 module screens live in three section folders at the project root:
   MM1/, MM2/ and MM4/. The app serves them from /legacy/<SECTION>/<file>, so
   the dev server streams them from those folders and the build copies them
   into dist/legacy/. Keeping one copy of each module avoids the stale
   duplicates we had when they lived under public/legacy. */
const MODULE_SECTIONS = ['MM1', 'MM2', 'MM4'];
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function moduleSectionAssets() {
  return {
    name: 'mfs-module-sections',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = decodeURIComponent((req.url || '').split('?')[0]);
        const match = /^\/legacy\/(MM[124])\/(.+)$/.exec(pathname);
        if (!match) return next();
        const file = resolve(process.cwd(), match[1], match[2]);
        if (!existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', MIME_TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      for (const section of MODULE_SECTIONS) {
        const from = resolve(process.cwd(), section);
        if (!existsSync(from)) continue;
        cpSync(from, resolve(process.cwd(), 'dist', 'legacy', section), { recursive: true });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'MM1_');
  const backendPort = env.MM1_APP_PORT || '8080';
  return {
    plugins: [react(), moduleSectionAssets()],
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), module: resolve(process.cwd(), 'module-entry.html') } },
    },
    server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:' + backendPort } },
  };
});
