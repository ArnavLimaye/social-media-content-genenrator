import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // The suite shares one isolated test.db (see vitest.global-setup.ts).
    // Several specs mutate it (post.spec, clients.spec, …); running files in
    // parallel races on shared rows (e.g. a client deleted out from under
    // another spec's post FK). Serialize files so each spec owns test.db for
    // its run. Tests within a file still run in order with beforeEach cleanup.
    fileParallelism: false,
  },
});