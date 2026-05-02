import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/docs-viewer/",
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
});
