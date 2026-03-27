import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { deployToCloudflarePages } from './deploy.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Multer: accept zip files or a directory? For simplicity, we accept a folder path via JSON.
app.use(express.json());

/**
 * POST /deploy
 * Body: { "projectName": "my-app", "buildFolder": "/absolute/path/to/dist" }
 * Returns: { "url": "https://my-app.pages.dev", "deploymentId": "..." }
 */
app.post('/deploy', async (req, res) => {
  try {
    const { projectName, buildFolder } = req.body;
    if (!projectName || !buildFolder) {
      return res.status(400).json({ error: 'projectName and buildFolder are required' });
    }

    // Check if buildFolder exists
    if (!fs.existsSync(buildFolder)) {
      return res.status(400).json({ error: `Build folder does not exist: ${buildFolder}` });
    }

    const result = await deployToCloudflarePages(projectName, buildFolder);
    res.json(result);
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple homepage to test
app.get('/', (req, res) => {
  res.send(`
    <h1>Cloudflare Pages Deployment Service</h1>
    <p>Send a POST request to <code>/deploy</code> with JSON:</p>
    <pre>{
  "projectName": "my-unique-project",
  "buildFolder": "/absolute/path/to/your/static/site"
}</pre>
  `);
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
