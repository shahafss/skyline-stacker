import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
  define: {
    __PERF_TOOLS__: JSON.stringify(process.env['VITE_PERF_TOOLS'] === '1'),
  },
});
