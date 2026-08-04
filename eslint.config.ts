import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['**/coverage/**', '**/node_modules/**', '**/*.config.*']),
  {
    name: 'regicide/javascript',
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
  },
  {
    name: 'regicide/typescript',
    files: [
      'packages/game-core/**/*.{ts,tsx}',
      'packages/game-application/**/*.{ts,tsx}',
      'packages/game-cli/**/*.{ts,tsx}',
    ],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    name: 'regicide/framework-independent-game-packages',
    files: ['packages/game-core/**/*.{ts,tsx}', 'packages/game-application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Game packages must remain framework-independent.' },
            { name: 'react-dom', message: 'Game packages cannot depend on DOM rendering.' },
          ],
          patterns: [
            { group: ['apps/*'], message: 'Game packages cannot depend on applications.' },
            { group: ['node:*'], message: 'Game packages cannot depend on Node APIs.' },
          ],
        },
      ],
    },
  },
  prettier,
)
