# Client Preview Portal

A private, password-protected showroom where your clients open the websites you built for them before they go live.
It's a plain static website with **no backend, no database and no PHP**. It runs on **Netlify**, where Claude Code
publishes new client sites automatically, and on any web space you can upload to with **FileZilla**.

![Access screen](docs/screenshots/gate.jpg)

Your client gets a link and a passcode. The access screen greets them, and once they type the code the site opens in a
viewer. There they can flip between **desktop, tablet and smartphone** frames, send you **feedback** and open the preview
**on their own phone via QR code**. All client-facing texts are **German by default** (formal *Sie*), and English is one click away.

| Welcome moment | Viewer (desktop) |
|---|---|
| ![Welcome](docs/screenshots/welcome.jpg) | ![Viewer](docs/screenshots/viewer-desktop.jpg) |
| **Smartphone frame** | **Project info & feedback** |
| ![Phone](docs/screenshots/viewer-mobile.jpg) | ![Info](docs/screenshots/info.jpg) |

---

## How it works

```
https://simontrummer-vorschau.netlify.app/?p=cafe-alma      +   passcode  DEMO-2026
                        │                                                │
                        └───────────────── SHA-256 ──────────────────────┘
                                             │
                          projects/cafe-alma_703d01e64ca560af/   ← the real website
```

- Every client website sits in `projects/` in a folder with a **secret name**. The name is calculated from the project ID and the passcode.
- The portal calculates that name from what the client types and opens the folder. A wrong passcode points to a folder
  that doesn't exist, so the client sees "Dieser Code passt leider nicht".
- **Nothing secret is stored in the portal**: there's no project list and there are no passcodes or hashes in the source code.

---

## Publishing with Netlify + Claude Code (automatic)

### One-time setup

1. **GitHub access for Claude.** Connect GitHub at <https://claude.ai/connect-github> and allow the Claude app on this
   repository (and on your client repositories). Sessions need this to save changes and to read client projects.
2. **Netlify token.** In Netlify: *User settings → Applications → Personal access tokens → New access token* (give it an
   expiry date). In Claude Code on the web, open the environment menu in the session's title bar and choose *Edit*. Add the token there as the
   environment variable **`NETLIFY_AUTH_TOKEN`**. Never paste it into a chat or commit it.
3. **Network access.** In the same environment settings, allow **`api.netlify.com`** and **`*.netlify.app`**.
4. **Optional: the Netlify connector.** At <https://claude.ai/customize/connectors>, connect *Netlify* to give Claude the
   Netlify MCP tools (site settings, domains, forms…) without a token. The repository also contains `.mcp.json`
   with the Netlify MCP server for the Claude Code CLI. It uses the same `NETLIFY_AUTH_TOKEN`.
5. **Site name.** `publish.config.json` → `netlifySite` is `simontrummer-vorschau`, so the portal will live at
   `https://simontrummer-vorschau.netlify.app`. Change it before the first publish if you like. A custom domain
   (e.g. `vorschau.simontrummer.at`) can be added in Netlify later; then put it in `portalUrl`.
6. Start a **new session** (settings are read at session start) and say: *"Richte das Vorschau-Portal auf Netlify ein."*
   Claude runs `setup` and `portal` and tells you the address.

### Every day: just ask Claude

- *"Veröffentliche SimonTrummer/baeckerei-mueller als Vorschau für Bäckerei Müller, Titel ‚Neue Website'."*
- *"Lade die neue Version von Bäckerei Müller hoch – Entwurf 2, neu: Galerie und Kontaktformular."*
- *"Welche Vorschauen sind gerade online?"* · *"Nimm die Vorschau von Café Alma offline."*

Claude follows the `publish-client-preview` skill in this repository. It builds the React/Vite project, uploads only that
client's folder, and answers with the **link**, the **passcode** and a **ready-to-send German message**. Existing previews
are never touched.

> Passcodes are stored nowhere, not even on Netlify, so save the one Claude shows you. If a client loses theirs, publish again
> with a new one (`--force`).

### Or run it yourself

```bash
export NETLIFY_AUTH_TOKEN=…                         # your personal access token
node tools/publish.mjs setup                       # check token + network, create the Netlify site
node tools/publish.mjs portal                      # put the portal online (again after changing config.js)

node tools/publish.mjs add ../baeckerei-mueller --name "Bäckerei Müller" --title "Neue Website" \
     --version "Entwurf 1" --note "Viel Spaß beim Durchklicken!" --pages "Start=/|Über uns=ueber-uns"
node tools/publish.mjs update ../baeckerei-mueller --slug baeckerei-mueller --version "Entwurf 2"
node tools/publish.mjs list
node tools/publish.mjs remove baeckerei-mueller
```

`node tools/publish.mjs --help` lists every option (`--code`, `--changes`, `--domain`, `--device`, `--no-build`,
`--dry-run`, `--json`, `--lang en`, …).

> **Why not the Netlify MCP "deploy" or `netlify deploy`?** They upload one folder as the *whole* site and delete every
> other client preview. The client sites are deliberately not in Git, so they would be gone. `tools/publish.mjs` sends
> Netlify the full file list, keeps everything that's already online and only uploads what's new. For the same reason,
> don't connect this repository to Netlify's Git builds.

---

## React / Vite client sites

`publish.mjs` builds Vite projects itself, from a temporary copy so your project stays untouched:

- **Base path.** Every build runs with `--base /projects/<secret-folder>/`, so JS, CSS, images and lazy-loaded routes all load.
- **React Router.** `<BrowserRouter>` and `createBrowserRouter(…)` get `basename={import.meta.env.BASE_URL}` added in the
  temporary copy. Routes like `/ueber-uns` therefore work inside the preview, including reload and deep links (`_redirects`
  sends unknown paths to the project's `index.html`).
- **Links to `public/` files.** JSX like `<img src="/team.jpg">` is rewritten to the preview path after the build.
- Dependencies are installed with npm, pnpm or yarn, depending on the lock file.

Anything else that isn't Vite: build it yourself with relative paths and publish the output folder with `--no-build`.

---

## Try it locally (2 minutes)

The passcode check needs a web server, so double-clicking `index.html` won't work.

- **VS Code:** *Live Server* extension → right-click `public/index.html` → *Open with Live Server*
- **Python:** in the `public` folder run `python -m http.server 8000` → <http://localhost:8000/?p=cafe-alma>
- **Node.js:** `npx serve public`

Then enter the demo passcode **`DEMO-2026`**. Case, spaces and dashes don't matter.

---

## Customize the portal

Edit **`public/config.js`**: name, tagline, contact details (email, phone, WhatsApp), brand color (`accent`), `theme`
(`dark` / `light` / `auto`), `language` (`de` / `en` / `auto`), optional logo and photo. Every option is explained in the
file. On Netlify, publish the change with `node tools/publish.mjs portal` (or ask Claude).

**Before going live:** replace the placeholders `hello@example.com` and the phone numbers.

---

## Without Netlify: FileZilla workflow

1. Upload the **contents** of `public/` to your web space (e.g. `preview.your-domain.com`).
2. For each client, double-click **`tools/studio.html`**. It shows the secret folder name, the passcode, the link, a QR code
   and the message to send.
3. **React/Vite projects:** run the command the Studio shows (`node tools/publish.mjs add … --local`). It builds the site
   into `public/projects/<folder>/`. Static sites: rename the folder as shown and put it into `public/projects/`.
4. Upload that folder with FileZilla into `/projects/` on the server.

![Preview Studio](docs/screenshots/studio.jpg)

The optional `.htaccess` adds the same protection headers and the React Router fallback on Apache servers.

---

## What your clients get

- An animated access screen with a 3D mockup and a lock that opens, followed by a personal welcome
- A viewer with **Desktop / Tablet / Smartphone** frames, rotation, back/forward/reload, a fake address bar showing the
  future domain, and a pages menu
- A **feedback** button: messages go to you by email or WhatsApp, with the page and device attached, or to a form service
  (Formspree / Web3Forms, see `config.js`)
- A **QR code** that opens the preview unlocked on the client's phone
- Your **personal note** and a *What's new* list for each version
- **Remember this device** for 30 days, plus a lock button
- **Self-hosted fonts and no external requests**, so no Google Fonts and nothing that needs a cookie banner

### `preview.json` (written by the publish script / Studio)

```json
{
  "customer": "Café Alma",
  "title": { "de": "Website-Relaunch", "en": "Website Relaunch" },
  "domain": "www.cafe-alma.at",
  "version": "Entwurf 2",
  "updated": "2026-09-25",
  "device": "desktop",
  "note": "Hier ist der zweite Entwurf Ihrer neuen Website! …",
  "changes": ["Neue Speisekarten-Seite", "Öffnungszeiten & Karte"],
  "pages": [{ "title": "Start", "path": "index.html" }, { "title": "Speisekarte", "path": "speisekarte.html" }]
}
```

Every field is optional. Any text can be given in two languages, as `{ "de": "…", "en": "…" }`.

---

## Security: what this protects, and what it doesn't

**What it protects:**

- The real files live in folders with unguessable names. Nobody finds them without the passcode, not even in the source code.
- On Netlify, `_headers` keeps search engines out and stops other sites from framing the portal. On Apache, `.htaccess` does
  the same, and `projects/index.html` blocks folder listings.
- Generated passcodes have about 40 bits of randomness, so guessing one means hundreds of billions of tries.

**Good to know:**

- This is protection by a secret address, like "anyone with the link". A client who opens the site in a new tab can forward
  that long address. Treat previews as *confidential*, not *top secret*. For truly sensitive content, Netlify's
  password protection (paid plans) or `.htpasswd` adds a server-checked login.
- The Netlify token can manage your whole Netlify account. Keep it only in the environment settings, give it an expiry
  date, and revoke it in Netlify if it ever leaks.
- Client projects are excluded in `.gitignore` because their folder names are the secret. Keep it that way.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Claude: *"No Netlify token found"* | Add `NETLIFY_AUTH_TOKEN` in the environment settings, then start a new session. |
| Claude: *"Could not reach api.netlify.com"* | Allow `api.netlify.com` and `*.netlify.app` in the environment's network access, then start a new session. |
| Claude can't read a client repository or save changes | Connect GitHub at <https://claude.ai/connect-github> and allow the Claude app on those repositories. |
| *"Netlify site … not found"* / name taken | Pick another `netlifySite` name: `node tools/publish.mjs setup --site <name>`. |
| Clients see a Netlify login page | In Netlify → *Project configuration → Access & security → Visitor access*, limit "Netlify team login" to non-production deploys. |
| React routes show a blank page or 404 | The router isn't one of the patched ones; add `basename={import.meta.env.BASE_URL}` to it. |
| *"Passcode doesn't match"* although it's right (FileZilla) | Compare the folder name with the Studio's, and check that `index.html` sits directly inside it. |
| A note says you opened the file from your computer | Use a local server (see *Try it locally*). |
| *500 Internal Server Error* on Apache | Your host doesn't allow one of the optional `.htaccess` settings. Delete `public/.htaccess`. |

---

## Folder structure

```
public/                          ← the portal (deploy root / FileZilla upload)
├── index.html, config.js        ← portal + your settings (config.js is the only file to edit)
├── _redirects, _headers         ← Netlify rules (SPA fallback, privacy headers)
├── .htaccess, robots.txt        ← the same for Apache / search engines
├── assets/                      ← styles, scripts, fonts, icons
└── projects/                    ← one folder per client (secret names, not in Git)
    ├── index.html               ← blocks folder listing
    └── cafe-alma_703d01e64ca560af/   ← demo (passcode DEMO-2026)
tools/
├── publish.mjs                  ← build + publish client sites (Netlify or --local)
└── studio.html                  ← local helper for the FileZilla workflow
publish.config.json              ← Netlify site name / portal URL
.mcp.json                        ← Netlify MCP server for Claude Code
CLAUDE.md, .claude/skills/       ← instructions Claude Code loads in future sessions
docs/screenshots/                ← images for this README
```

## Other ways to solve this

- **Password protection from your host** (`.htpasswd`, *Verzeichnisschutz*) or **Netlify's password protection**:
  checked by the server, but the login box can't be styled.
- **[StatiCrypt](https://github.com/robinmoisson/staticrypt)**: encrypts HTML pages with a password; fiddly for sites with
  many pages and images.
- **Separate Netlify/Vercel deploy previews per client**: proper hosting, but no shared, branded portal and no passcode screen.

## Credits

- Fonts: [Inter](https://rsms.me/inter/) and [Instrument Serif](https://github.com/Instrument/instrument-serif); the demo
  site also uses [Fraunces](https://github.com/undercasetype/Fraunces). All under the SIL Open Font License (see the
  `LICENSE-fonts.txt` files).
- Icons based on [Lucide](https://lucide.dev) (ISC) and [Tabler Icons](https://tabler.io/icons) (MIT).
- The QR code generator follows [Project Nayuki's QR Code generator](https://www.nayuki.io/page/qr-code-generator-library) (MIT).
