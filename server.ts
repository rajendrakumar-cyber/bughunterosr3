import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- GitHub OAuth Routes ---

  app.get("/api/auth/github/url", (req, res) => {
    const redirectUri = `${process.env.APP_URL}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "repo",
      state: Math.random().toString(36).substring(7),
    });
    const authUrl = `https://github.com/login/oauth/authorize?${params}`;
    res.json({ url: authUrl });
  });

  app.get("/auth/github/callback", async (req, res) => {
    const { code } = req.query;
    
    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await tokenResponse.json();
      
      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GITHUB_AUTH_SUCCESS', 
                  token: '${data.access_token}' 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("GitHub OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // --- GitHub API Proxy ---

  app.post("/api/github/push", async (req, res) => {
    const { token, repo, path: filePath, content, message } = req.body;
    
    if (!token || !repo || !filePath || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // 1. Get current file (to get SHA if it exists)
      const getFileResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      let sha;
      if (getFileResponse.ok) {
        const fileData = await getFileResponse.json();
        sha = fileData.sha;
      }

      // 2. Push file
      const pushResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message || "BountyHunter OS: Export Report",
          content: Buffer.from(content).toString("base64"),
          sha,
        }),
      });

      const result = await pushResponse.json();
      if (!pushResponse.ok) {
        throw new Error(result.message || "Failed to push to GitHub");
      }

      res.json({ success: true, url: result.content.html_url });
    } catch (error: any) {
      console.error("GitHub Push Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
