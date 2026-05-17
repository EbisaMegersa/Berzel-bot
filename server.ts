import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database in memory (per user)
  const userData = new Map<string, { balance: number; adsWatched: number }>();

  function getUser(userId: string) {
    if (!userData.has(userId)) {
      userData.set(userId, { balance: 0, adsWatched: 0 });
    }
    return userData.get(userId)!;
  }

  // API Routes
  app.get("/api/balance", (req, res) => {
    const userId = (req.headers["x-user-id"] as string) || "guest";
    const data = getUser(userId);
    res.json(data);
  });

  app.post("/api/watch-ad", (req, res) => {
    const userId = (req.headers["x-user-id"] as string) || "guest";
    const data = getUser(userId);
    
    // Simulate some "server-side" ad processing
    data.balance += 1;
    data.adsWatched += 1;
    
    res.json({ success: true, ...data });
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
