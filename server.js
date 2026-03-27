import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { deployToCloudflarePages } from './deploy.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';  // Required for Render to route traffic

app.use(express.json());

// Health check endpoint for Render – returns OK immediately
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

/**
 * POST /deploy
 * Body: { "projectName": "my-app", "buildFolder": "/absolute/path/to/dist" }
 */
app.post('/deploy', async (req, res) => {
  try {
    const { projectName, buildFolder } = req.body;
    if (!projectName || !buildFolder) {
      return res.status(400).json({ error: 'projectName and buildFolder are required' });
    }

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

const server = app.listen(port, host, () => {
  console.log(`🚀 Server running on http://${host}:${port}`);
});

// Increase timeouts to prevent health check failures during cold starts
server.keepAliveTimeout = 120000;   // 2 minutes
server.headersTimeout = 120000;     // 2 minutes
