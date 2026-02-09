import {resolve} from 'node:path'

import {includeIgnoreFile} from '@eslint/compat'
import eslintConfig from '@sanity/eslint-config-cli'
import {defineConfig} from 'eslint/config'

export default defineConfig([
  includeIgnoreFile(resolve(import.meta.dirname, '.gitignore')),
  ...eslintConfig,
  {
    rules: {
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          ignores: [
            'import.meta.dirname',
            'fetch',
            'Response',
            'DecompressionStream',
            'ReadableStream',
            'util.styleText',
          ],
        },
      ],
    },
  },
])
