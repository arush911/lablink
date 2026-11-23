import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    env: {
      ENABLE_LOCAL_DEMO_AUTH: "true",
      NODE_ENV: "test",
    },
  },
});
