module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    camelcase: 'off',
    semi: [2, 'always'],
    'no-template-curly-in-string': 'off',
    'no-return-assign': 'off'
  }
};
