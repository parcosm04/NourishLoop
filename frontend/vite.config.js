import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        donor: resolve(import.meta.dirname, 'donor.html'),
        receiver: resolve(import.meta.dirname, 'receiver.html')
      }
    }
  }
});
