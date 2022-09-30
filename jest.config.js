module.exports = {
  preset: "@shelf/jest-dynamodb",
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
};
