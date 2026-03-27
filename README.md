# Cloudflare Deployment Service

Deploy static websites to Cloudflare Pages via a simple REST API.

## Prerequisites
- Node.js 16+
- Cloudflare account with a Pages‑enabled zone (free tier works)

## Setup
1. Clone this repository.
2. Copy `.env.example` to `.env` and fill in your Cloudflare credentials.
3. Run `npm install`.
4. Start the server: `npm start` (or `npm run dev` for auto‑reload).

## Usage
Send a `POST` request to `/deploy` with JSON body:
```json
{
  "projectName": "my-user-app",
  "buildFolder": "/absolute/path/to/dist"
}
Response:

json
{
  "url": "https://my-user-app.pages.dev",
  "deploymentId": "..."
}
Notes
The build folder must contain the static files you want to deploy (e.g., index.html, CSS, JS).

Project names must be unique across your Cloudflare account.

If the project doesn't exist, it will be created automatically.

text

---

## ✅ Test the Deployment

1. Create a simple static site in a folder (e.g., `/tmp/my-site` with `index.html`).
2. Start the server: `npm start`.
3. Use `curl` or Postman to test:

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"projectName":"test-app","buildFolder":"/tmp/my-site"}'
You should receive a URL like https://test-app.pages.dev. Visit it – your site is live!

