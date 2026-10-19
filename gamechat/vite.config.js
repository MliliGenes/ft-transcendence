import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        watch: {
            // Wait until a file save finishes before reloading it.
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        }
    }
});
