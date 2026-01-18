import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // Project root
  base: './', // Relative base path for asset loading
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'esnext',
  },
  server: {
    port: 3000,
    open: true,
  },
  // Ensure static assets (like mp3s in root) are served
  publicDir: 'public', // Defaults to 'public', but our assets are in root.
  // Vite serves root files automatically during dev, but for build, we might need to move them or configure copy.
  // For now, let's keep it simple. We might need to move 'images', 'mp3s' to a 'public' folder later for cleaner structure.
});
