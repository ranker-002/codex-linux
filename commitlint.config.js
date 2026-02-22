module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting
        'refactor', // Code refactoring
        'perf',     // Performance
        'test',     // Tests
        'chore',    // Build/dependencies
        'ci',       // CI/CD
        'revert',   // Revert
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [2, 'always', 100],
  },
};