import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database in memory
  let balance = 0;
  let adsWatched = 0;

  // API Routes
  app.get("/api/balance", (req, res) => {
    res.json({ balance, adsWatched });
  });

  app.post("/api/watch-ad", (req, res) => {
    // Simulate some "server-side" ad processing
    balance += 1;
    adsWatched += 1;
    res.json({ success: true, balance, adsWatched });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
