import { join } from "path"

export default async () => {
  return {
    rootDir: "src",
    preset: "ts-jest",
    testPathIgnorePatterns: [
      "__tests__",
      "ipc.test.ts",
      "addresses.test.ts"
    ],
    globalSetup: join(process.cwd(), "src", "test_setup.js"),
  }
}
