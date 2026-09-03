import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    tailwindcss(),
    viteReact(),
  ],
  resolve: { tsconfigPaths: true },
  envPrefix: "VITE_",
  build: { cssMinify: true },
});