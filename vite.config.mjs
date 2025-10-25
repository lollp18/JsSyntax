import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "frontend/app.js"),
      name: "SytaxJs",
      fileName: (format) => `sytax-js.${format}.js`,
    },
  },
  server: {
    port: 3000,
  },
});
