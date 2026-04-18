import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { deployToCloudflarePages } from './deploy.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

app.get('/health', (req, res) => res.status(200).send('OK'));

app.post('/deploy', upload.single('file'), async (req, res) => {
  try {
    const { projectName } = req.body;
    const file = req.file;

    if (!projectName) return res.status(400).json({ error: 'projectName required' });
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const tempDir = path.join('/tmp', `cloudflare-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, 'site.zip');
    fs.writeFileSync(zipPath, file.buffer);

    // Extract using adm-zip
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);

    const result = await deployToCloudflarePages(projectName, tempDir);

    fs.rmSync(tempDir, { recursive: true, force: true });
    res.json(result);
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send(`<h1>Cloudflare Deploy Service</h1><pre>curl -X POST https://cloud-puller.onrender.com/deploy -F "projectName=my-app" -F "file=@site.zip"</pre>`);
});

const server = app.listen(port, host, () => console.log(`🚀 Running on ${host}:${port}`));
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;
