import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const typescriptFiles = ['**/*.{ts,tsx}']
const reactFiles = ['apps/web/**/*.{ts,tsx}', 'packages/game-ui/**/*.{ts,tsx}']

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/*.config.*',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
  },
  {
    files: typescriptFiles,
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: new URL('../..', import.meta.url).pathname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
    },
  },
  {
    files: reactFiles,
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['packages/game-core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'game-core 必须保持与 UI 框架无关。',
            },
            {
              name: 'react-dom',
              message: 'game-core 不能依赖 DOM 渲染。',
            },
            {
              name: '@regicide/game-application',
              message: 'game-core 不能反向依赖 application 层。',
            },
            {
              name: '@regicide/game-ui',
              message: 'game-core 不能反向依赖 UI 层。',
            },
          ],
          patterns: ['apps/*', '@regicide/game-application/*', '@regicide/game-ui/*'],
        },
      ],
    },
  },
  {
    files: ['packages/game-application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'application 层必须保持与 React 无关。',
            },
            {
              name: 'react-dom',
              message: 'application 层不能依赖 DOM 渲染。',
            },
            {
              name: '@regicide/game-ui',
              message: 'application 层不能反向依赖 UI 层。',
            },
          ],
          patterns: ['apps/*', '@regicide/game-ui/*'],
        },
      ],
    },
  },
  {
    files: ['packages/game-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@regicide/game-core',
              message: 'UI 应通过 application 层访问游戏能力。',
            },
          ],
          patterns: ['@regicide/game-core/*'],
        },
      ],
    },
  },
  prettier,
)
