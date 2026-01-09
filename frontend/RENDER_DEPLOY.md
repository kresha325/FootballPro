# Render Deployment Instructions for FootballPro Frontend

This file documents the Render-specific static hosting setup for the frontend.

## Build & Start Commands
- **Build Command:**
  ```
  npm install && npm run build
  ```
- **Start Command:**
  ```
  npx serve -s dist
  ```
- **Root Directory:**
  frontend

## Environment Variables
- Set `VITE_API_URL` in the Render dashboard to your backend API URL.

## SPA Routing
- No special configuration needed. `serve -s dist` automatically handles SPA fallback to `index.html`.

## Notes
- `vercel.json` is not used for Render and can be ignored or deleted.
- If you have custom headers or rewrites, configure them via Render's dashboard or a static.json file if needed (not required for most Vite SPAs).

---
For more details, see the main README or contact the team.