import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/biteos/" : "/",
  define: {
    "import.meta.env.VITE_DEMO": JSON.stringify(
      mode === "pages" ? "true" : "false",
    ),
  },
  build: { outDir: mode === "pages" ? "dist-pages" : "dist" },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    proxy: { "/api/tenants/": "http://127.0.0.1:8092", "/api": "http://127.0.0.1:8090" },
  },
}));
