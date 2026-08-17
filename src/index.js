/**
 * ArtAround Backend Entry Point
 * Express server with MongoDB connection
 */

const http = require("http")
const express = require("express")
const cors = require("cors")
const path = require("path") //aggiunto per il deploy
const { connectDB } = require("./config/db")
const env = require("./config/env")
const apiRoutes = require("./routes")
const errorHandler = require("./middleware/errorHandler")
const { initSocket } = require("./services/socketService")
const Museum = require("./models/Museum")

const runSeed = require("../scripts/seed")

const app = express()
const server = http.createServer(app)

// Middleware
app.use(cors())
app.use(express.json())
// app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")))

// Marketplace frontend (vanilla HTML/CSS/ES modules, served from
// frontend-marketplace). One route per page; static mounts cover css/js/assets.
const marketplaceDir = path.join(__dirname, "..", "frontend-marketplace")
app.use("/marketplace/css", express.static(path.join(marketplaceDir, "css")))
app.use("/marketplace/js", express.static(path.join(marketplaceDir, "js")))
app.use(
    "/marketplace/assets",
    express.static(path.join(marketplaceDir, "assets")),
)
app.get("/marketplace", (req, res) => {
    res.sendFile(path.join(marketplaceDir, "pages", "home.html"))
})
app.get("/marketplace/museums", (req, res) => {
    res.sendFile(path.join(marketplaceDir, "pages", "museums.html"))
})
app.get("/marketplace/museums/:slug", (req, res) => {
    res.sendFile(path.join(marketplaceDir, "pages", "museum.html"))
})

// The other marketplace implementation, parked at a second path rather than
// deleted. Fully static (URLs carry real paths and .html extensions), so the
// whole directory is mounted as-is. Nothing links here — it's reachable only by
// typing the URL. See docs/MARKETPLACE.md.
const marketplaceV2Dir = path.join(__dirname, "..", "frontend", "marketplace")
app.get("/marketplace-v2", (req, res) => {
    res.redirect("/marketplace-v2/pages/homepage.html")
})
app.use("/marketplace-v2", express.static(marketplaceV2Dir))

// API routes
app.use("/api", apiRoutes)

// Navigator frontend (React SPA, Vite-built into frontend-navigator/dist).
// Mounted after /api and /marketplace so it doesn't shadow them. The catch-all
// only matches paths without a file extension so missing assets still 404
// instead of returning HTML. Everything not under /api, /marketplace, or
// /uploads is owned by the navigator.
const navigatorDir = path.join(__dirname, "..", "frontend-navigator", "dist")

// Rotta aggiunta per supportare il percorso generato dal link relativo HTML
app.use("/frontend-navigator/dist", express.static(navigatorDir))

app.use(express.static(navigatorDir))
app.get(
    /^\/(?!api|marketplace|uploads|frontend-navigator)[^.]*$/,
    (req, res) => {
        res.sendFile(path.join(navigatorDir, "index.html"))
    },
)

// Error handling
app.use(errorHandler)

// Initialize Socket.io
initSocket(server)

// Start server
const startServer = async () => {
    try {
        await connectDB()

        // Bootstrap demo data only for an empty database. Re-seeding on every
        // restart used to delete users and visits created through the UI.
        const museumCount = await Museum.countDocuments()
        if (museumCount === 0) {
            await runSeed()
        }

        server.listen(env.PORT, () => {
            console.log(
                `Server running on port ${env.PORT} in ${env.NODE_ENV} mode`,
            )
        })
    } catch (error) {
        console.error("Failed to start server:", error)
        process.exit(1)
    }
}

startServer()
