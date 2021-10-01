module.exports = {
  extends: [
    '@geolonia/eslint-config/typescript',
  ],
  env: {
    node: true,
    jest: true,
  },
  parserOptions: {
    project: ['tsconfig.json'],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
