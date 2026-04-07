import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;

console.log('🔍 DEBUG: CLOUDFLARE_ACCOUNT_ID =', CLOUDFLARE_ACCOUNT_ID);
console.log('🔍 DEBUG: CLOUDFLARE_API_TOKEN prefix =', CLOUDFLARE_API_TOKEN ? CLOUDFLARE_API_TOKEN.substring(0,15) : 'MISSING');

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  throw new Error('Missing Cloudflare credentials. Check environment variables.');
}

/**
 * Ensure a Cloudflare Pages project exists (create if missing)
 */
async function ensureProject(projectName) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`;
  const listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
  });
  const listData = await listRes.json();
  if (!listData.success) {
    throw new Error(`Failed to list projects: ${JSON.stringify(listData.errors)}`);
  }

  const exists = listData.result.some(p => p.name === projectName);
  if (!exists) {
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        production_branch: 'main',
      }),
    });
    const createData = await createRes.json();
    if (!createData.success) {
      throw new Error(`Failed to create project: ${JSON.stringify(createData.errors)}`);
    }
    console.log(`✅ Created project: ${projectName}`);
  } else {
    console.log(`ℹ️ Project already exists: ${projectName}`);
  }
}

/**
 * Recursively collect all files from a directory, returning both the file map and a manifest.
 */
async function collectFilesWithManifest(dirPath, baseDir = dirPath) {
  const files = new Map(); // relative path -> Buffer
  const manifest = {};     // relative path -> { size, hash? } (hash is optional but recommended)

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      const sub = await collectFilesWithManifest(fullPath, baseDir);
      for (const [subPath, content] of sub.files.entries()) {
        files.set(subPath, content);
      }
      Object.assign(manifest, sub.manifest);
    } else {
      const content = await fs.promises.readFile(fullPath);
      files.set(relativePath, content);
      // Compute SHA256 hash (required by Cloudflare)
      const hash = createHash('sha256').update(content).digest('hex');
      manifest[relativePath] = {
        size: content.length,
        hash: hash,
      };
    }
  }
  return { files, manifest };
}

/**
 * Deploy a folder to Cloudflare Pages.
 */
export async function deployToCloudflarePages(projectName, buildFolder) {
  console.log(`🚀 Starting deployment for ${projectName} from ${buildFolder}`);
  await ensureProject(projectName);

  console.log('📦 Collecting files and generating manifest...');
  const { files, manifest } = await collectFilesWithManifest(buildFolder);
  console.log(`📁 Found ${files.size} files`);

  const form = new FormData();
  // Add the manifest as a JSON string field
  form.append('manifest', JSON.stringify(manifest), { contentType: 'application/json' });
  // Add each file
  for (const [relativePath, content] of files.entries()) {
    form.append(relativePath, content, { filename: relativePath });
  }

  const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`;
  console.log(`🚀 Posting to ${deployUrl}`);
  
  const deployRes = await fetch(deployUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const deployData = await deployRes.json();
  if (!deployData.success) {
    console.error('❌ Deployment failed:', deployData.errors);
    throw new Error(`Deployment failed: ${JSON.stringify(deployData.errors)}`);
  }

  const deployment = deployData.result;
  const url = deployment.url;
  const deploymentId = deployment.id;

  console.log(`✅ Deployed ${projectName} → ${url}`);
  return { url, deploymentId };
}