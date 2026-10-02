// Las mismas reglas que la PC (TS strict type-checked, dinero en enteros) más las de hooks de React.
// Usa las dependencias de lint de la raíz: correr `npm ci` en la raíz antes de `npm run lint` acá.
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import base from '../../eslint.config.mjs'

export default [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'dist-web/**',
      'test-results/**',
      'android/**',
      'ios/**',
      'expo-env.d.ts',
    ],
  },
  ...base,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { files: ['e2e/**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['metro.config.js', 'plugins/**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
