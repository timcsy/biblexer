// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// 原則 4「不含任何生成模組」：@huggingface/transformers 只能在 embedder 被 import，
// 且任何地方都不得使用 pipeline（它是通往文字生成任務的入口）。
const transformersOnlyInEmbedder = {
  paths: [
    {
      name: '@huggingface/transformers',
      message: '只有 src/embed/embedder.ts 可以 import @huggingface/transformers（原則 4）。',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'public/',
      '.cache/',
      'test-results/',
      'playwright-report/',
      '.specify/',
      '.claude/',
      '.agents/',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // noUncheckedIndexedAccess 下，非空斷言是索引存取的必要寫法
      '@typescript-eslint/no-non-null-assertion': 'off',
      // 神版經文「　神」的全形空白是刻意保留的
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipComments: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', transformersOnlyInEmbedder],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='pipeline']",
          message: '禁止使用 pipeline（原則 4：不含任何生成模組）。',
        },
        {
          selector: "ImportSpecifier[imported.name='pipeline']",
          message: '禁止 import pipeline（原則 4：不含任何生成模組）。',
        },
      ],
    },
  },
  {
    files: ['src/embed/embedder.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
