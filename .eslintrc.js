module.exports = {
  extends: [
    '@geolonia/eslint-config/typescript',
  ],
  env: {
    node: true,
    jest: true,
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        'no-console': 'off',
      },
      parserOptions: {
        project: ['tsconfig.json'],
      },
    },
  ],
};
