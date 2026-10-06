// Home Services Booking App - Full Stack server (Node.js + MongoDB Atlas)
// Serves the frontend (HTML/CSS/JS) and the REST API under /api
const http = require("http");
const fs = require("fs");
const path = require("path");
const config = require("./backend/config");
const db = require("./backend/db");
const { handle } = require("./backend/routes");

const PORT = config.PORT;
const FRONTEND = path.join(__dirname, "frontend");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".png": "image/png",
  ".ico": "image/x-icon", ".svg": "image/svg+xml", ".json": "application/json"
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname.startsWith("/api/")) return handle(req, res, pathname);

  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.join(FRONTEND, rel);
  if (!file.startsWith(FRONTEND + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

// Connect to MongoDB Atlas first, then start accepting requests
db.connect()
  .then(() => {
    server.listen(PORT, () => console.log(`HomeServices running at http://localhost:${PORT} (MongoDB connected)`));
  })
  .catch(err => {
    console.error("Could not connect to MongoDB:", err.message);
    process.exit(1);
  });

process.on("SIGINT", async () => { await db.close(); process.exit(0); });
