/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/coverage/**', '**/dist/**', '**/node_modules/**', '**/.turbo/**'],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  rules: { 'custom-property-pattern': null, 'selector-class-pattern': null },
}
