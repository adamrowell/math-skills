import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'public/ort',
      // Legacy v1 app: kept on disk for reference, unrouted (see docs/DESIGN.md). Lint it
      // again when a mode is ported into the new shell.
      'tests/legacy/**',
      'src/LegacyApp.tsx',
      'src/{AlgebraApp,ArcadeApp,ChartApp,GeographyApp,MathApp,ReadingApp,WordProblemsApp,ModeSelect}.tsx',
      'src/components/**',
      'src/config/**',
      'src/games/**',
      'src/hooks/**',
      'src/utils/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
