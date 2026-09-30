import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/property/**/*.test.ts', 'tests/guards/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'data',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'acceptance',
          environment: 'node',
          include: ['tests/acceptance/**/*.test.ts'],
          testTimeout: 600_000,
        },
      },
    ],
  },
});
