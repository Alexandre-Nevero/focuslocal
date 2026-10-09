import {defineConfig} from "vite";

export default defineConfig({
    build: {
        ssr: "native-host/host.ts",
        outDir: "out/native-host",
        // Installer-owned launcher and manifest must survive subsequent builds.
        emptyOutDir: false,
        target: "node22"
    }
});
