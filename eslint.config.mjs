import {FlatCompat} from '@eslint/eslintrc'
import eslint from '@eslint/js'
import {defineConfig} from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: eslint.configs.recommended,
})

export default defineConfig(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  ...compat.extends('sanity'),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        NodeJS: 'readonly',
        BufferEncoding: 'readonly',
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/no-var-requires': 'off',
      'no-dupe-class-members': 'off',
      'no-redeclare': 'off',
      'no-unused-expressions': 'off',
      'no-unused-vars': 'off',
      'no-useless-constructor': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    files: ['*.js', '*.cjs'],
    // @ts-expect-error - disableTypeChecked config is compatible with ESLint flat config
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  eslintConfigPrettier,
)
