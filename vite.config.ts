import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  staged: {
    "*.{ts,tsx}": "eslint --fix",
  },
  plugins: [react()],
  lint: {},
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts", "server/**/*.test.ts"],
  },
  server: {
    proxy: {
      "/trpc": apiProxyTarget,
      "/api": apiProxyTarget,
    },
  },
});
