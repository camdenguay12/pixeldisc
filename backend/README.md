# Pixel Disc Cloudflare backend

This Worker and D1 database replace Google Apps Script/Sheets for live leaderboards and activity. The existing GitHub Pages game is left unchanged until deployment is verified.

## Deploy
1. Create a free Cloudflare account and a D1 database named `pixeldisc-db` in the Cloudflare dashboard. Copy its database ID into `wrangler.toml`.
2. On your computer, clone this repository and install Node.js. Run `npx wrangler login`.
3. Run `npx wrangler d1 execute pixeldisc-db --remote --file=backend/schema.sql` from the repository root.
4. Run `cd backend && npx wrangler deploy`. Copy the published `https://pixeldisc-api.<account>.workers.dev` URL.
5. Check `<worker-url>/health` and `<worker-url>/leaderboard` in a browser. Both should return JSON. Then configure the game to use this URL (next integration step).

The API exposes GET /health, GET /leaderboard, GET /stats and POST /event. CORS permits the Pixel Disc GitHub Pages origin. Requests return explicit JSON success/failure rather than opaque no-cors results.

Note: Score totals are submitted by the client and are not cheat-proof. Add server-side round verification before treating rankings as competitive or awarding prizes. Avoid logging personal identifiers; session IDs are pseudonymous.
