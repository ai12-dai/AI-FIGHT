// Vite config for the game frontend. Lives in client/ so the frontend is
// self-contained: `vite build client` uses this folder as the root.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(clientDir, '..');

export default defineConfig({
  root: clientDir,
  plugins: [react()],
  resolve: {
    // input limits and scoring rules are shared with the server's test judge
    alias: { '@rules': path.join(projectDir, 'server/rules.js') },
  },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
    fs: { allow: [projectDir] },
  },
  build: {
    outDir: path.join(projectDir, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
});
