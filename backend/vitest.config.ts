import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
    },
    server: {
      deps: {
        external: [/^node:/, /node_modules/],
      },
    },
  },
});
