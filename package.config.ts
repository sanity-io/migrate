import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  extract: {
    checkTypes: false,
    rules: {
      'ae-internal-missing-underscore': 'off',
    },
  },
  tsconfig: 'tsconfig.build.json',
})
