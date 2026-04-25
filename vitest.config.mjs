import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/_setup/foundry-mocks.mjs"],
    include: ["tests/**/*.test.mjs"],
    environment: "node"
  }
});
