import express from 'express';
import multer from 'multer';
import { extract } from 'extract-zip';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { deployToCloudflarePages } from './deploy.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

// Configure multer to store files in memory
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Debug endpoint
app.get('/debug/env', (req, res) => {
  res.json({
    hasAccountId: !!process.env.CLOUDFLARE_ACCOUNT_ID,
    accountIdPrefix: process.env.CLOUDFLARE_ACCOUNT_ID?.substring(0,10) || null,
    hasToken: !!process.env.CLOUDFLARE_API_TOKEN,
    tokenPrefix: process.env.CLOUDFLARE_API_TOKEN?.substring(0,15) || null,
  });
});

/**
 * POST /deploy - accepts multipart/form-data with fields:
 *   projectName (string)
 *   file (zip archive)
 */
app.post('/deploy', upload.single('file'), async (req, res) => {
  try {
    const { projectName } = req.body;
    const file = req.file;

    if (!projectName) {
      return res.status(400).json({ error: 'projectName is required' });
    }
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create a temporary directory
    const tempDir = path.join('/tmp', `cloudflare-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Save the uploaded zip
    const zipPath = path.join(tempDir, 'site.zip');
    fs.writeFileSync(zipPath, file.buffer);

    // Extract the zip
    await extract(zipPath, { dir: tempDir });

    // Deploy the extracted folder
    const result = await deployToCloudflarePages(projectName, tempDir);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    res.json(result);
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Cloudflare Pages Deployment Service</h1>
    <p>Upload a zip file via POST /deploy with multipart/form-data.</p>
    <pre>curl -X POST https://cloud-puller.onrender.com/deploy -F "projectName=my-app" -F "file=@site.zip"</pre>
  `);
});

const server = app.listen(port, host, () => {
  console.log(`🚀 Server running on http://${host}:${port}`);
});
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;
