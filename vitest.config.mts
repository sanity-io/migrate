import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/**/*.d.ts'],
      include: ['src/**/*.ts'],
    },
    disableConsoleIntercept: true, // helps @oclif/test helpers
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
