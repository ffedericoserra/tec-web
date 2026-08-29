import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    plugins: [react()],
    // Navigator routes are deep links, so bundle assets must always resolve
    // from the site root rather than from the current museum/visit URL.
    base: "/",
    server: {
        port: 5173,
        proxy: {
            "/api": "http://localhost:8000",
            "/uploads": "http://localhost:8000",
            // ws:true is required — without it the socket.io handshake upgrades and
            // then dies, and the session runner silently never receives an event.
            "/socket.io": { target: "http://localhost:8000", ws: true },
        },
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
})
