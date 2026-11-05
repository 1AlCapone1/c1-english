import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH is set in CI for GitHub Pages (e.g. "/c1-english/")
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
