import { join } from "path"

export default async () => {
  return {
    rootDir: "src",
    preset: "ts-jest",
    testPathIgnorePatterns: [
      "__tests__"
    ],
    globalSetup: join(process.cwd(), "src", "test_setup.js"),
  }
}
