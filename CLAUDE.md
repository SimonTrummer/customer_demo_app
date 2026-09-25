# Client Preview Portal

Private, passcode-protected showroom for client websites. Static site, no backend. Hosted on Netlify
(site `simontrummer-vorschau`, ID `da0788dc-8178-4e26-8839-ca050980a43b`, name also in `publish.config.json`);
it also works on any FileZilla/Apache web space. This repository is **public**: never commit secrets or client builds.

## Layout

- `public/` – the portal (deploy root). `public/config.js` holds branding, contact details and texts (German by default, formal "Sie").
- `public/projects/<project-id>_<16 hex>/` – one folder per client site. The hex suffix is derived from project ID + passcode
  (`public/assets/js/core.js`), so a wrong passcode points to a folder that doesn't exist. Passcodes are never stored anywhere.
- `public/_redirects`, `public/_headers` – Netlify config (SPA fallback for React Router, noindex headers). `.htaccess` is the Apache equivalent.
- `tools/publish.mjs` – builds client sites (React/Vite) and deploys to Netlify **incrementally**. `tools/studio.html` – manual helper for the FileZilla workflow.
- `.mcp.json` – Netlify MCP (auth via `NETLIFY_AUTH_TOKEN`) for site management tasks.

## Publishing client previews

Use the `publish-client-preview` skill. In short:

```bash
node tools/publish.mjs setup                                   # check token, network, site
node tools/publish.mjs add <client-project> --name "Kunde" --title "Website-Relaunch" --json
node tools/publish.mjs update <client-project> --slug kunde    # new version, same link + passcode
node tools/publish.mjs list | remove <id> | portal
```

## Rules

- **Deploy only with `tools/publish.mjs`.** The Netlify MCP `deploy-site` tool, `netlify deploy` and Git-connected Netlify builds
  replace the whole site and would delete every other client preview (they are not in Git).
- Never commit built client sites to Git: their folder names are secrets and `.gitignore` excludes them. The demo
  `public/projects/cafe-alma_703d01e64ca560af/` (passcode `DEMO-2026`) is the only tracked project.
- Never print, log or commit `NETLIFY_AUTH_TOKEN`, and never ask the user to paste a token into the chat.
- Write client-facing texts in German unless told otherwise.
- Don't change a client's own repository without asking. The publish script patches React Router's `basename` only in a temporary build copy.
- After changing portal files in `public/`, deploy with `node tools/publish.mjs portal` when the user wants it live. That deploy keeps all client previews.

## Checks

- `node --check public/assets/js/portal.js tools/publish.mjs`
- Local preview: `cd public && python3 -m http.server 8000` → <http://localhost:8000/?p=cafe-alma>, passcode `DEMO-2026`
