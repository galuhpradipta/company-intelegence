import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

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
});
