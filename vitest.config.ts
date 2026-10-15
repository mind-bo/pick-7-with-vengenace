import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import preact from "@preact/preset-vite";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
          exclude: ["test/room-do.test.ts", "test/web/**"],
        },
      },
      {
        plugins: [preact()],
        test: { name: "web", environment: "happy-dom", include: ["test/web/**/*.test.{ts,tsx}"] },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: { name: "do", include: ["test/room-do.test.ts"] },
      },
    ],
  },
});
