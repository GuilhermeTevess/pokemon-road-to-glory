import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// `base` relativo para funcionar tanto local quanto no GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
});
