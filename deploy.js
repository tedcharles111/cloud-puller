import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;

// Debug: log first few characters (safe for logs)
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
  console.log(`🔍 Ensuring project: ${projectName}, URL: ${url}`);
  
  const listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
  });
  const listData = await listRes.json();
  if (!listData.success) {
    console.error('❌ Failed to list projects:', listData.errors);
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
 * Recursively collect all files from a directory as a Map (relative path -> file content)
 */
async function collectFiles(dirPath, baseDir = dirPath) {
  const files = new Map();
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      const subFiles = await collectFiles(fullPath, baseDir);
      for (const [subPath, content] of subFiles.entries()) {
        files.set(subPath, content);
      }
    } else {
      const content = await fs.promises.readFile(fullPath);
      files.set(relativePath, content);
    }
  }
  return files;
}

/**
 * Deploy a folder to Cloudflare Pages.
 * @param {string} projectName - Unique project name (e.g., "my-user-app")
 * @param {string} buildFolder - Absolute path to the built static site
 * @returns {Promise<{url: string, deploymentId: string}>}
 */
export async function deployToCloudflarePages(projectName, buildFolder) {
  console.log(`🚀 Starting deployment for ${projectName} from ${buildFolder}`);
  await ensureProject(projectName);

  console.log('📦 Collecting files...');
  const files = await collectFiles(buildFolder);
  console.log(`📁 Found ${files.size} files`);

  const form = new FormData();
  for (const [relativePath, content] of files.entries()) {
    form.append(relativePath, content, relativePath);
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