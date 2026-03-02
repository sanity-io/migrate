import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/**/*.d.ts'],
      include: ['src/**/*.ts'],
    },
    disableConsoleIntercept: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
