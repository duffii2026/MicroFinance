import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'MM1_');
  const backendPort = env.MM1_APP_PORT || '8080';
  return {
    plugins: [react()],
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), module: resolve(process.cwd(), 'module-entry.html') } },
    },
    server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:' + backendPort } },
  };
});
