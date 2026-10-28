import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // Oyun motoru ve ekonomi kuralları saf kalmalı: tohumsuz rastgelelik ve tarayıcı/React yasak (RULES.md 7, 9).
    files: ['src/engine/**/*.ts', 'src/economy/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Motorda Math.random yasak; rng.ts kullan.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'setTimeout', 'setInterval'],
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'react/*'] }],
    },
  },
)
