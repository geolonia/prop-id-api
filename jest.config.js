module.exports = {
  globalSetup: './__test__/dynamodb.setup.js',
  globalTeardown: './__test__/dynamodb.teardown.js',
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  testPathIgnorePatterns: [
    "bin",
    "__tests__",
    "ipc.test.ts",
    "addresses.test.ts"
  ],
  testEnvironment: "node"
};
