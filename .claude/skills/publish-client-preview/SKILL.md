---
name: publish-client-preview
description: Publish a client's website (React/Vite project or finished static site) to the private preview portal on Netlify, publish a new version of an existing preview, list or remove previews, or deploy portal changes. Use when the user asks to upload, publish, share, send or update a client site or preview – e.g. "Kundenseite hochladen", "Vorschau für … veröffentlichen", "neue Version online stellen".
---

# Publish a client preview

Everything goes through `node tools/publish.mjs` in the root of this repository. It builds the client site, deploys to Netlify
**incrementally** (all other client previews stay online) and prints link, passcode and a ready-to-send German message.

Never deploy this site any other way: the Netlify MCP `deploy-site` tool, `netlify deploy` and Git-based builds replace the
whole site and delete every other client preview.

## 1. Check the setup

```bash
node tools/publish.mjs setup
```

- **"No Netlify token found"** → stop and tell the user: create a Netlify personal access token (Netlify → User settings →
  Applications → Personal access tokens) and add it as environment variable `NETLIFY_AUTH_TOKEN` in the environment settings
  (cloud: environment menu in the session title bar → Edit). A new session picks it up. Never ask for the token in the chat.
- **"Could not reach api.netlify.com"** → the user must allow `api.netlify.com` and `*.netlify.app` in the environment's
  network access settings, then start a new session.
- **Site not found** → `setup` creates it from `publish.config.json` → `netlifySite`. If the name is taken, ask the user for
  another name and run `node tools/publish.mjs setup --site <name>` (it saves the name; commit `publish.config.json`).
- If setup says the portal isn't online yet: `node tools/publish.mjs portal`.

## 2. Get the client project

- GitHub repository → attach it with the repository tool, clone it, and use that path.
- Otherwise a local folder the user points to. A finished build (folder with `index.html`) works too, with `--no-build`.
- Look at `package.json`: Vite projects are built automatically; other build tools need a finished build + `--no-build`.

## 3. Publish

**New client** (ask only for what you can't infer; the default version label is "Entwurf 1"):

```bash
node tools/publish.mjs add <path> --name "Bäckerei Müller" --title "Neue Website" \
  --version "Entwurf 1" --note "Persönliche Nachricht an den Kunden" \
  --changes "Startseite|Über uns" --pages "Start=/|Über uns=ueber-uns" --domain www.baeckerei-mueller.at --json
```

- `--name` is shown in the welcome screen. `--slug` defaults to a URL-safe form of the name.
- A strong passcode is generated unless the user asked for one (`--code`).
- `--pages` fills the "Seiten" menu: `Title=path`, paths relative to the site (React routes like `ueber-uns` work).

**New version of an existing preview** (same link, same passcode):

```bash
node tools/publish.mjs update <path> --slug baeckerei-mueller --version "Entwurf 2" --changes "Neue Galerie|Kontaktformular" --json
```

**Other tasks**

| Task | Command |
|---|---|
| Show all previews online | `node tools/publish.mjs list` |
| New passcode (old one stops working) | `node tools/publish.mjs add <path> --name "…" --force` |
| Take a preview offline | `node tools/publish.mjs remove <slug>` |
| Portal changes (config.js, texts, design) | `node tools/publish.mjs portal` |
| FileZilla instead of Netlify | add `--local` → writes into `public/projects/` |
| Just check what would change | add `--dry-run` |

## 4. Check the result

- Read `notes` in the JSON output. Lines starting with ⚠ need action, e.g. links that start with `/` in a site that wasn't
  built by Vite, or a React Router setup the script couldn't patch (then suggest `basename={import.meta.env.BASE_URL}`
  and ask before changing the client's repository).
- If `*.netlify.app` is reachable: `curl -s -o /dev/null -w "%{http_code}" "<portalUrl>projects/<folder>/preview.json"` → 200.

## 5. Tell the user (in German unless the conversation is in English)

- **Link** and **Zugangscode** (bold). Say clearly that the passcode is stored nowhere and should be saved now.
- The **Direktlink** (`magicLink`) opens the preview without typing the code – only for people they trust.
- The ready-to-send **message** from the output, in a code block so it can be copied.
- Any ⚠ notes, in plain words.

## Rules

- Don't commit built client sites (`public/projects/*`); `.gitignore` excludes them on purpose. `remove` also deletes a local
  copy – commit that deletion if it was tracked (the demo).
- Never print, log or commit `NETLIFY_AUTH_TOKEN`.
- Don't modify the client's own repository without asking.
