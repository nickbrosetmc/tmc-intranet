import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Stamp every build with an id, exposed two ways that always agree:
//   - __BUILD_ID__  inlined into the client bundle (the running version)
//   - /version.json emitted into the output (the deployed version)
// The client polls version.json and prompts a reload when they differ.
const BUILD_ID = String(Date.now());

function buildId(): Plugin {
  return {
    name: "tmc-build-id",
    config: () => ({ define: { __BUILD_ID__: JSON.stringify(BUILD_ID) } }),
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId: BUILD_ID }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), buildId()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
