import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@skyline/web',
    root: import.meta.dirname,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
