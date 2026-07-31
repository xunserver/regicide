import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import type { ConfigWithExtends } from '@eslint/config-helpers'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const typescriptFiles = ['**/*.{ts,tsx}']
const reactFiles = ['apps/web/**/*.{ts,tsx}', 'packages/game-ui/**/*.{ts,tsx}']

const projectIgnores = globalIgnores([
  '**/dist/**',
  '**/dist-ssr/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/.turbo/**',
  '**/*.config.*',
])

const javascriptConfig: ConfigWithExtends = {
  name: 'regicide/javascript',
  files: ['**/*.{js,mjs,cjs}'],
  extends: [js.configs.recommended],
  languageOptions: {
    ecmaVersion: 'latest' as const,
    globals: globals.node,
    sourceType: 'module' as const,
  },
}

const typescriptConfig: ConfigWithExtends = {
  name: 'regicide/typescript',
  files: typescriptFiles,
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
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
  },
}

const reactPlugins = {
  'react-hooks': reactHooks,
  'react-refresh': reactRefresh,
} as unknown as NonNullable<ConfigWithExtends['plugins']>

const reactConfig: ConfigWithExtends = {
  name: 'regicide/react',
  files: reactFiles,
  languageOptions: { globals: globals.browser },
  plugins: reactPlugins,
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
}

const architectureConfigs: ConfigWithExtends[] = [
  {
    name: 'regicide/architecture/game-core',
    files: ['packages/game-core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'game-core 必须保持与 UI 框架无关。' },
            { name: 'react-dom', message: 'game-core 不能依赖 DOM 渲染。' },
            {
              name: '@regicide/game-application',
              message: 'game-core 不能反向依赖 application 层。',
            },
            { name: '@regicide/game-ui', message: 'game-core 不能反向依赖 UI 层。' },
          ],
          patterns: ['apps/*', '@regicide/game-application/*', '@regicide/game-ui/*'],
        },
      ],
    },
  },
  {
    name: 'regicide/architecture/game-application',
    files: ['packages/game-application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'application 层必须保持与 React 无关。' },
            { name: 'react-dom', message: 'application 层不能依赖 DOM 渲染。' },
            { name: '@regicide/game-ui', message: 'application 层不能反向依赖 UI 层。' },
          ],
          patterns: ['apps/*', '@regicide/game-ui/*'],
        },
      ],
    },
  },
  {
    name: 'regicide/architecture/game-ui',
    files: ['packages/game-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@regicide/game-core', message: 'UI 应通过 application 层访问游戏能力。' },
          ],
          patterns: ['@regicide/game-core/*'],
        },
      ],
    },
  },
]

export default defineConfig(
  projectIgnores,
  javascriptConfig,
  typescriptConfig,
  reactConfig,
  ...architectureConfigs,
  prettier,
)
