import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Les stats calendaires dépendent du fuseau : on fige celui des tests.
    env: { TZ: 'Europe/Paris' },
    include: ['tests/**/*.test.ts'],
  },
});
