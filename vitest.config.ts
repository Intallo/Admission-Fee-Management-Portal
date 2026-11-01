import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import crypto from 'crypto';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/empty-module.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    cache: false,
    env: {
      ACTOR_SIGNING_SECRET: process.env.ACTOR_SIGNING_SECRET || crypto.randomBytes(32).toString('hex'),
    },
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  },
});
