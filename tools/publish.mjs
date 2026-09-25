#!/usr/bin/env node
/**
 * Preview Portal — publish client previews.
 *
 * Puts a client's website online inside the private preview portal on Netlify,
 * or (with --local) into public/projects/ for a manual FileZilla upload.
 * React/Vite projects are built automatically with the right base path.
 *
 * Netlify deploys are incremental: only the given client folder (or the portal files)
 * change – every other client preview that is already online stays untouched.
 *
 *   node tools/publish.mjs setup [--site <name>]        first-time setup / connection check
 *   node tools/publish.mjs portal                        publish portal changes (config.js, texts, …)
 *   node tools/publish.mjs add <source> --name "Café Alma" [options]
 *   node tools/publish.mjs update <source> --slug cafe-alma [options]
 *   node tools/publish.mjs list
 *   node tools/publish.mjs remove <project-id>
 *
 * Run with --help for all options. No dependencies; Node 18+.
 * Needs NETLIFY_AUTH_TOKEN (a Netlify personal access token) for everything except --local.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set at startup (Node ≥ 22.21).
   Cloud environments route all traffic through such a proxy, so restart once with it enabled. */
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const quiet = process.allowedNodeEnvironmentFlags.has('--disable-warning') ? ['--disable-warning=UNDICI-EHPA'] : [];
  const child = spawnSync(process.execPath, [...quiet, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' }
  });
  process.exit(child.status ?? 1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'publish.config.json');
const API_BASE = (process.env.NETLIFY_API_URL || 'https://api.netlify.com/api/v1').replace(/\/+$/, '');
const FOLDER_RE = /^([a-z0-9-]+)_([0-9a-f]{16})$/;
const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '.git', '.htaccess', 'node_modules']);
const BOOLEAN_FLAGS = new Set(['help', 'json', 'dry-run', 'local', 'no-build', 'force', 'create-site']);

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  bold: (s) => (tty ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s) => (tty ? `\x1b[2m${s}\x1b[22m` : s),
  green: (s) => (tty ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s) => (tty ? `\x1b[33m${s}\x1b[39m` : s),
  red: (s) => (tty ? `\x1b[31m${s}\x1b[39m` : s)
};

class UserError extends Error {}

/* ───────────────────────── helpers ───────────────────────── */

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    let key = arg.slice(2);
    let value;
    const eq = key.indexOf('=');
    if (eq > -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else if (BOOLEAN_FLAGS.has(key) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      value = true;
    } else {
      value = argv[++i];
    }
    out[key.replace(/-([a-z])/g, (m, ch) => ch.toUpperCase())] = value;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function log(...args) {
  if (!options.json) console.log(...args);
}

function note(list, text) {
  list.push(text);
  log(c.dim('  · ' + text));
}

/** Runs a browser script (core.js / config.js) in a sandbox and returns its `window`. */
function loadBrowserScript(file) {
  const window = { crypto: crypto.webcrypto };
  const context = vm.createContext({ window, TextEncoder, console });
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return window;
}

function loadConfig() {
  const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
  const publicDir = path.resolve(ROOT, cfg.publicDir || 'public');
  const portal = loadBrowserScript(path.join(publicDir, 'config.js')).PORTAL_CONFIG || {};
  const core = loadBrowserScript(path.join(publicDir, 'assets/js/core.js')).PreviewCore;
  return {
    netlifySite: process.env.NETLIFY_SITE_ID || cfg.netlifySite || '',
    portalUrl: cfg.portalUrl || '',
    publicDir,
    projectsFolder: String(portal.projectsFolder || 'projects').replace(/^\/+|\/+$/g, ''),
    designer: (portal.contact && portal.contact.name) || (portal.brand && portal.brand.name) || '',
    core
  };
}

function withSlash(url) {
  return url.replace(/\/*$/, '/');
}

async function walk(dir, base = dir, out = []) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const stat = entry.isSymbolicLink() ? await fsp.stat(abs) : entry;
    if (stat.isDirectory()) await walk(abs, base, out);
    else if (stat.isFile()) out.push({ abs, rel: toPosix(path.relative(base, abs)) });
  }
  return out;
}

function childEnv() {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.NODE_USE_ENV_PROXY; // only needed for this script's own fetch calls
  return env;
}

function runCommand(cmd, args, cwd, label) {
  log(c.dim(`  $ ${[cmd, ...args].join(' ')}`));
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: options.json ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
    env: childEnv()
  });
  if (result.status !== 0) {
    const detail = options.json && result.stderr ? '\n' + result.stderr.toString().slice(-2000) : '';
    throw new UserError(`${label} failed (exit code ${result.status}).${detail}`);
  }
}

/* ───────────────────────── Netlify API ───────────────────────── */

function token() {
  const t = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_PERSONAL_ACCESS_TOKEN;
  if (!t) {
    throw new UserError(
      'No Netlify token found. Create a personal access token in Netlify (User settings → Applications → Personal access tokens)\n' +
      'and provide it as the environment variable NETLIFY_AUTH_TOKEN.\n' +
      'Claude Code on the web: add it in the cloud environment settings (Edit environment → environment variables) and start a new session.'
    );
  }
  return t;
}

async function api(method, route, { json, body, headers = {}, allow404 = false, raw = false, timeout = 60000 } = {}) {
  const url = route.startsWith('http') ? route : API_BASE + route;
  const auth = token();
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${auth}`,
          'User-Agent': 'preview-portal-publish',
          ...(json ? { 'Content-Type': 'application/json' } : {}),
          ...headers
        },
        body: json ? JSON.stringify(json) : body,
        signal: AbortSignal.timeout(timeout)
      });
    } catch (err) {
      if (attempt < 3) {
        await sleep(1000 * attempt);
        continue;
      }
      const host = new URL(url).host;
      throw new UserError(
        `Could not reach ${host} (${(err.cause && (err.cause.code || err.cause.message)) || err.message}).\n` +
        `Claude Code on the web: allow "${host}" in the environment's network settings (Edit environment → Network access) and start a new session.`
      );
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1500 * attempt;
      await sleep(Math.min(wait, 20000));
      continue;
    }
    if (res.status === 404 && allow404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new UserError(`Netlify rejected the token (HTTP ${res.status}). Check that NETLIFY_AUTH_TOKEN is a valid personal access token.`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = text;
      try { message = JSON.parse(text).message || text; } catch (e) { /* plain text */ }
      throw new UserError(`Netlify API ${method} ${route} failed: HTTP ${res.status} ${message}`.trim());
    }
    if (raw) return res;
    const text = await res.text();
    return { data: text ? JSON.parse(text) : null, headers: res.headers };
  }
}

async function findSite(cfg, { create = false } = {}) {
  const ref = cfg.netlifySite;
  if (!ref) throw new UserError('No Netlify site configured. Run: node tools/publish.mjs setup --site <name>');
  const candidates = [ref];
  if (!ref.includes('.') && !/^[0-9a-f-]{36}$/.test(ref)) candidates.push(`${ref}.netlify.app`);
  for (const id of candidates) {
    const res = await api('GET', `/sites/${encodeURIComponent(id)}`, { allow404: true });
    if (res && res.data) return res.data;
  }
  const list = await api('GET', `/sites?name=${encodeURIComponent(ref)}&filter=all&per_page=100`);
  const match = (list.data || []).find((s) => s.name === ref);
  if (match) return match;
  if (!create) throw new UserError(`Netlify site "${ref}" not found. Create it with: node tools/publish.mjs setup`);
  log(`Creating Netlify site ${c.bold(ref)} …`);
  const created = await api('POST', '/sites', { json: { name: ref } });
  return created.data;
}

async function listRemoteFiles(site) {
  const files = new Map();
  let next = `/sites/${site.id}/files`;
  while (next) {
    const res = await api('GET', next, { allow404: true });
    if (!res) break;
    for (const f of res.data || []) files.set(f.path.startsWith('/') ? f.path : '/' + f.path, f.sha);
    const link = res.headers.get('link') || '';
    const m = /<([^>]+)>;\s*rel="next"/.exec(link);
    next = m ? m[1] : null;
  }
  return files;
}

async function readRemoteFile(site, filePath, portalUrl) {
  // 1) Netlify API (raw content)  2) the live website
  try {
    const res = await api('GET', `/sites/${site.id}/files${filePath.split('/').map(encodeURIComponent).join('/')}`, {
      allow404: true,
      raw: true,
      headers: { Accept: 'application/vnd.bitballoon.v1.raw' }
    });
    if (res) {
      const text = await res.text();
      const data = JSON.parse(text);
      const looksLikeMetadata = data && data.sha && data.mime_type && data.path;
      if (!looksLikeMetadata) return data;
    }
  } catch (e) { /* fall through */ }
  try {
    const res = await fetch(new URL(filePath.slice(1), portalUrl), { signal: AbortSignal.timeout(20000) });
    if (res.ok) return JSON.parse(await res.text());
  } catch (e) { /* not reachable */ }
  return null;
}

/**
 * Creates a deploy with the file-digest method: we send the complete file list (path → sha1),
 * Netlify answers with the digests it doesn't have yet, and only those get uploaded.
 */
async function deployFiles(site, files, title) {
  const digest = {};
  for (const [p, f] of files) digest[p] = f.sha;
  const created = await api('POST', `/sites/${site.id}/deploys?title=${encodeURIComponent(title)}`, {
    json: { files: digest, draft: false, async: true },
    timeout: 120000
  });
  let deploy = created.data;
  for (let i = 0; ['new', 'preparing'].includes(deploy.state) && i < 120; i++) {
    await sleep(1000);
    deploy = (await api('GET', `/deploys/${deploy.id}`)).data;
  }
  if (deploy.state === 'error') throw new UserError(`Netlify could not prepare the deploy: ${deploy.error_message || 'unknown error'}`);

  const required = new Set(deploy.required || []);
  const uploads = [];
  const seen = new Set();
  for (const [p, f] of files) {
    if (!required.has(f.sha) || seen.has(f.sha)) continue;
    if (!f.abs && !f.buffer) throw new UserError(`Netlify no longer has the file ${p}. Re-publish that project with "update".`);
    seen.add(f.sha);
    uploads.push([p, f]);
  }
  let done = 0;
  const queue = uploads.slice();
  async function worker() {
    while (queue.length) {
      const [p, f] = queue.shift();
      const buffer = f.buffer || (await fsp.readFile(f.abs));
      const encoded = p.slice(1).split('/').map(encodeURIComponent).join('/');
      await api('PUT', `/deploys/${deploy.id}/files/${encoded}`, {
        body: buffer,
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 300000
      });
      done++;
      if (!options.json && tty) process.stdout.write(`\r  Uploading ${done}/${uploads.length} files…`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, uploads.length) }, worker));
  if (uploads.length && !options.json && tty) process.stdout.write('\n');
  log(c.dim(`  Uploaded ${uploads.length} new or changed files (${files.size} files in total).`));

  for (let i = 0; deploy.state !== 'ready' && i < 180; i++) {
    if (deploy.state === 'error' || deploy.state === 'rejected') {
      throw new UserError(`Netlify deploy failed: ${deploy.error_message || deploy.state}`);
    }
    await sleep(1000);
    deploy = (await api('GET', `/deploys/${deploy.id}`)).data;
  }
  if (deploy.state !== 'ready') throw new UserError(`Deploy ${deploy.id} is still "${deploy.state}" – check the Netlify dashboard.`);
  return deploy;
}

/* ───────────────────────── file sets ───────────────────────── */

async function localFiles(cfg) {
  const files = new Map();
  for (const { abs, rel } of await walk(cfg.publicDir)) {
    files.set('/' + rel, { sha: sha1(await fsp.readFile(abs)), abs });
  }
  return files;
}

function projectFolderOf(filePath, cfg) {
  const prefix = `/${cfg.projectsFolder}/`;
  if (!filePath.startsWith(prefix)) return null;
  const rest = filePath.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash < 1) return null;
  const folder = rest.slice(0, slash);
  return FOLDER_RE.test(folder) ? folder : null;
}

function foldersIn(files, cfg) {
  const folders = new Map();
  for (const p of files.keys()) {
    const folder = projectFolderOf(p, cfg);
    if (folder) folders.set(folder, (folders.get(folder) || 0) + 1);
  }
  return folders;
}

/**
 * The files of the next deploy: the portal from public/ (plus client folders stored there),
 * every client folder that is already online, minus `drop`, plus the new folder.
 */
function composeDeploy({ cfg, local, remote, drop = new Set(), addFolder = null, addFiles = null }) {
  const files = new Map();
  const localFolders = foldersIn(local, cfg);
  for (const [p, sha] of remote) {
    const folder = projectFolderOf(p, cfg);
    if (!folder || drop.has(folder) || folder === addFolder || localFolders.has(folder)) continue;
    files.set(p, { sha });
  }
  for (const [p, f] of local) {
    const folder = projectFolderOf(p, cfg);
    if (folder && (drop.has(folder) || folder === addFolder)) continue;
    files.set(p, f);
  }
  if (addFiles) for (const [p, f] of addFiles) files.set(p, f);
  return files;
}

function describeChanges(remote, next) {
  let added = 0;
  let changed = 0;
  let removed = 0;
  for (const [p, f] of next) {
    if (!remote.has(p)) added++;
    else if (remote.get(p) !== f.sha) changed++;
  }
  for (const p of remote.keys()) if (!next.has(p)) removed++;
  return `${added} new, ${changed} changed, ${removed} removed`;
}

/* ───────────────────────── building client sites ───────────────────────── */

/** Scans JS/TS source for the end of a call's argument list, skipping strings and comments. */
function scanCall(src, openIndex) {
  let depth = 0;
  const commas = [];
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '/' && next === '/') { i = src.indexOf('\n', i); if (i < 0) return null; continue; }
    if (ch === '/' && next === '*') { i = src.indexOf('*/', i + 2) + 1; if (i <= 0) return null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return { close: i, commas };
    } else if (ch === ',' && depth === 1) commas.push(i);
  }
  return null;
}

/** React Router needs the sub-folder as basename. Patches a temporary copy only. */
function patchRouter(dir, notes) {
  const exts = /\.(jsx?|tsx?|mjs)$/;
  const files = [];
  (function collect(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'build', 'public', '.git'].includes(entry.name)) continue;
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) collect(abs);
      else if (exts.test(entry.name)) files.push(abs);
    }
  })(dir);

  const BASE = 'import.meta.env.BASE_URL';
  for (const file of files) {
    let src = fs.readFileSync(file, 'utf8');
    if (!/react-router/.test(src)) continue;
    const before = src;
    const rel = toPosix(path.relative(dir, file));

    // <BrowserRouter> (also when imported under another name)
    const names = new Set(['BrowserRouter']);
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]react-router(?:-dom)?['"]/g)) {
      for (const alias of m[1].matchAll(/BrowserRouter\s+as\s+([A-Za-z_$][\w$]*)/g)) names.add(alias[1]);
    }
    for (const name of names) {
      src = src.replace(new RegExp(`<${name}(?=[\\s>])([^>]*)>`, 'g'), (tag, attrs) => (
        /\bbasename\b/.test(attrs) ? tag : `<${name} basename={${BASE}}${attrs}>`
      ));
    }

    // createBrowserRouter(routes[, options])
    let from = 0;
    for (;;) {
      const idx = src.indexOf('createBrowserRouter(', from);
      if (idx < 0) break;
      const open = idx + 'createBrowserRouter'.length;
      from = open + 1;
      if (/[\w$.]/.test(src[idx - 1] || '') || /^\s*(?:function|import)/.test(src.slice(Math.max(0, idx - 20), idx))) continue;
      const call = scanCall(src, open);
      if (!call) continue;
      const argsText = src.slice(open + 1, call.close);
      if (/\bbasename\b/.test(argsText)) continue;
      const realCommas = call.commas.filter((pos) => src.slice(pos + 1, call.close).trim() !== '');
      if (realCommas.length === 0) {
        const insertAt = call.commas.length ? call.commas[call.commas.length - 1] : call.close;
        src = src.slice(0, insertAt) + `, { basename: ${BASE} }` + src.slice(call.commas.length ? insertAt + 1 : insertAt);
      } else {
        const second = src.slice(realCommas[0] + 1, call.close);
        const brace = second.indexOf('{');
        if (brace > -1 && second.slice(0, brace).trim() === '') {
          const at = realCommas[0] + 1 + brace + 1;
          src = src.slice(0, at) + ` basename: ${BASE},` + src.slice(at);
        } else {
          note(notes, `⚠ ${rel}: createBrowserRouter has options without basename – add "basename: import.meta.env.BASE_URL" if routes don't match.`);
        }
      }
    }

    if (src !== before) {
      fs.writeFileSync(file, src);
      note(notes, `React Router in ${rel} uses the preview's sub-folder as basename (temporary build copy only – the project itself is unchanged).`);
    }
  }
}

/** JSX like <img src="/team.jpg"> points to the domain root – prefix such links to files from public/. */
async function rewritePublicLinks(sourceDir, outDir, basePath, notes) {
  if (basePath === '/') return;
  const publicDir = path.join(sourceDir, 'public');
  if (!fs.existsSync(publicDir)) return;
  const publicFiles = (await walk(publicDir)).map((f) => f.rel).filter((rel) => rel !== 'index.html');
  if (!publicFiles.length) return;
  const escaped = publicFiles.sort((a, b) => b.length - a.length).map((rel) => rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(["'\`]|url\\()\\/(${escaped.join('|')})(?=["'\`)?#])`, 'g');
  let count = 0;
  for (const { abs } of await walk(outDir)) {
    if (!/\.(html|js|mjs|css)$/.test(abs)) continue;
    const text = await fsp.readFile(abs, 'utf8');
    const replaced = text.replace(pattern, (m, pre, rel) => { count++; return `${pre}${basePath}${rel}`; });
    if (replaced !== text) await fsp.writeFile(abs, replaced);
  }
  if (count) note(notes, `Fixed ${count} link(s) to files from public/ that started with "/" (e.g. <img src="/logo.png">).`);
}

async function checkRootLinks(outDir, basePath, notes) {
  const index = path.join(outDir, 'index.html');
  if (!fs.existsSync(index)) throw new UserError('The build has no index.html.');
  const html = await fsp.readFile(index, 'utf8');
  const bad = [...html.matchAll(/\s(?:src|href)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]).filter((u) => !u.startsWith(basePath));
  if (bad.length) {
    note(notes, `⚠ index.html links to ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? ' …' : ''} at the domain root – these files won't load in the preview. Use relative paths.`);
  }
}

function hasCommand(cmd) {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return r.status === 0;
}

function installDependencies(dir) {
  if (fs.existsSync(path.join(dir, 'node_modules'))) return;
  log('Installing dependencies …');
  const via = (tool, args) => (hasCommand(tool) ? runCommand(tool, args, dir, `${tool} install`) : runCommand('npx', ['--yes', tool, ...args], dir, `${tool} install`));
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) via('pnpm', ['install', '--frozen-lockfile']);
  else if (fs.existsSync(path.join(dir, 'yarn.lock'))) via('yarn', ['install', '--frozen-lockfile']);
  else if (fs.existsSync(path.join(dir, 'package-lock.json'))) runCommand('npm', ['ci', '--no-audit', '--no-fund'], dir, 'npm ci');
  else runCommand('npm', ['install', '--no-audit', '--no-fund'], dir, 'npm install');
}

/** Returns a temporary folder with the finished website, built for `basePath`. */
async function buildSource(source, basePath) {
  const src = path.resolve(source);
  if (!fs.existsSync(src)) throw new UserError(`Folder not found: ${src}`);
  const notes = [];
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'preview-'));
  const out = path.join(tmp, 'site');
  const pkgFile = path.join(src, 'package.json');

  if (options.noBuild || !fs.existsSync(pkgFile)) {
    if (!fs.existsSync(path.join(src, 'index.html'))) {
      throw new UserError(`${src} has no index.html. Pass a Vite project or the folder of a finished website (e.g. dist/).`);
    }
    fs.cpSync(src, out, { recursive: true, filter: (p) => !SKIP_NAMES.has(path.basename(p)) });
    note(notes, 'Used the folder as it is (no build step).');
    await checkRootLinks(out, basePath, notes);
    return { dir: out, notes };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps.vite) {
    throw new UserError('This is not a Vite project. Build it yourself and publish the output folder with --no-build (the site must use relative paths).');
  }
  installDependencies(src);

  // Build from a temporary copy so the client's project stays untouched.
  const work = path.join(tmp, 'work');
  const topLevelSkip = new Set(['node_modules', '.git', 'dist', 'build', '.netlify', '.vercel', 'coverage']);
  fs.cpSync(src, work, {
    recursive: true,
    filter: (p) => {
      const rel = path.relative(src, p);
      return !rel || !topLevelSkip.has(rel.split(path.sep)[0]);
    }
  });
  fs.symlinkSync(path.join(src, 'node_modules'), path.join(work, 'node_modules'), 'junction');
  patchRouter(work, notes);

  const viteCli = path.join(src, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteCli)) throw new UserError('Vite is not installed in the project (node_modules/vite missing).');
  log(`Building ${c.bold(pkg.name || path.basename(src))} with Vite …`);
  runCommand(process.execPath, [viteCli, 'build', '--base', basePath, '--outDir', out, '--emptyOutDir'], work, 'Vite build');
  await rewritePublicLinks(src, out, basePath, notes);
  await checkRootLinks(out, basePath, notes);
  return { dir: out, notes };
}

/* ───────────────────────── preview.json + messages ───────────────────────── */

function list(value) {
  if (!value || value === true) return [];
  return String(value).split(/\s*\|\s*|\n/).map((s) => s.trim()).filter(Boolean);
}

function buildMeta(existing = {}) {
  const meta = { ...existing };
  const set = (key, value) => { if (typeof value === 'string' && value.trim()) meta[key] = value.trim(); };
  set('customer', options.name);
  set('title', options.title);
  set('domain', options.domain);
  set('version', options.version);
  set('note', options.note);
  set('entry', options.entry);
  if (['desktop', 'tablet', 'mobile'].includes(options.device)) meta.device = options.device;
  if (options.changes) meta.changes = list(options.changes);
  if (options.pages) {
    meta.pages = list(options.pages).map((item) => {
      const eq = item.indexOf('=');
      const title = eq > -1 ? item.slice(0, eq).trim() : item;
      const pagePath = (eq > -1 ? item.slice(eq + 1) : item).trim().replace(/^\/+/, '');
      return { title, path: pagePath || 'index.html' };
    });
  }
  meta.updated = today();
  return meta;
}

function clientMessage({ lang, customer, title, link, code, update }) {
  const designer = config.designer;
  if (lang === 'en') {
    if (update) {
      return `Hi ${customer},\n\na new version${title ? ` of “${title}”` : ''} is ready to view:\n\n👉 ${link}\n\nYour passcode stays the same. I’m looking forward to your feedback!\n\nBest regards,\n${designer}`;
    }
    return `Hi ${customer},\n\n${title ? `the preview of “${title}” is ready! 🎉` : 'your website preview is ready! 🎉'}\n\n👉 ${link}\n🔑 Passcode: ${code}\n\n` +
      'Just open the link and enter the passcode – it works on your computer, tablet and phone. Use the “Feedback” button to send me your notes directly.\n\n' +
      `Looking forward to hearing what you think!\n\nBest regards,\n${designer}`;
  }
  if (update) {
    return `Hallo ${customer},\n\neine neue Version${title ? ` von „${title}“` : ''} ist online:\n\n👉 ${link}\n\nIhr Zugangscode bleibt gleich. Ich freue mich auf Ihr Feedback!\n\nViele Grüße\n${designer}`;
  }
  return `Hallo ${customer},\n\n${title ? `die Vorschau für „${title}“ ist fertig! 🎉` : 'Ihre Website-Vorschau ist fertig! 🎉'}\n\n👉 ${link}\n🔑 Zugangscode: ${code}\n\n` +
    'Öffnen Sie einfach den Link und geben Sie den Code ein – das funktioniert am Computer, Tablet und Smartphone. Über den Button „Feedback“ können Sie mir direkt Ihre Anmerkungen schicken.\n\n' +
    `Ich freue mich auf Ihre Rückmeldung!\n\nViele Grüße\n${designer}`;
}

function pick(value, lang) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value[lang] || value.de || value.en || Object.values(value)[0];
  return value;
}

/* ───────────────────────── commands ───────────────────────── */

async function context({ create = false } = {}) {
  const site = await findSite(config, { create });
  const portalUrl = withSlash(config.portalUrl || site.ssl_url || site.url || `https://${site.name}.netlify.app`);
  return { site, portalUrl };
}

/** Deploys the result of `compose(remote)`; retries once if someone else deployed in the meantime. */
async function publish({ site, title, compose }) {
  const local = await localFiles(config);
  for (let attempt = 1; ; attempt++) {
    const publishedBefore = (site.published_deploy && site.published_deploy.id) || null;
    const remote = await listRemoteFiles(site);
    const next = compose(local, remote);
    log(c.dim(`  Changes: ${describeChanges(remote, next)}`));
    if (options.dryRun) {
      log(c.yellow('  --dry-run: nothing was uploaded.'));
      return { deploy: null, remote, next };
    }
    const fresh = (await api('GET', `/sites/${site.id}`)).data;
    const publishedNow = (fresh.published_deploy && fresh.published_deploy.id) || null;
    if (publishedNow !== publishedBefore && attempt < 3) {
      log(c.yellow('  Someone published in the meantime – merging again …'));
      site = fresh;
      continue;
    }
    const deploy = await deployFiles(site, next, title);
    return { deploy, remote, next };
  }
}

async function cmdSetup() {
  if (options.site && options.site !== true) {
    const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    cfg.netlifySite = String(options.site);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n');
    config.netlifySite = cfg.netlifySite;
    log(`Saved site name "${cfg.netlifySite}" in publish.config.json (commit this file).`);
  }
  token();
  const user = (await api('GET', '/user')).data;
  log(`${c.green('✔')} Netlify token works (${user.email || user.full_name || 'account ok'}).`);
  const { site, portalUrl } = await context({ create: true });
  const remote = await listRemoteFiles(site);
  const projects = foldersIn(remote, config);
  log(`${c.green('✔')} Site ${c.bold(site.name)} – ${portalUrl}`);
  log(`  Admin: ${site.admin_url || 'https://app.netlify.com'}`);
  log(`  Client previews online: ${projects.size}`);
  if (!remote.size) log(`\nNext step: ${c.bold('node tools/publish.mjs portal')} to put the portal online.`);
  return { site: site.name, siteId: site.id, portalUrl, adminUrl: site.admin_url, projects: projects.size };
}

async function cmdPortal() {
  const { site, portalUrl } = await context({ create: Boolean(options.createSite) });
  log(`Publishing the portal to ${c.bold(portalUrl)} …`);
  const { deploy, next } = await publish({
    site,
    title: 'Portal update',
    compose: (local, remote) => composeDeploy({ cfg: config, local, remote })
  });
  const projects = foldersIn(next, config);
  if (deploy) log(`${c.green('✔')} Portal is online: ${portalUrl} (${projects.size} client preview${projects.size === 1 ? '' : 's'} kept).`);
  return { portalUrl, deployId: deploy && deploy.id, projects: projects.size };
}

function requireSource() {
  const source = options._[1] || options.source;
  if (!source || source === true) throw new UserError('Missing <source>: the client project folder (Vite project) or a finished website folder.');
  return source;
}

async function cmdAdd() {
  const source = requireSource();
  if (!options.name || options.name === true) throw new UserError('Missing --name "Client name".');
  const slug = config.core.slugify(options.slug && options.slug !== true ? options.slug : options.name);
  if (!slug) throw new UserError('Could not derive a project ID. Pass --slug my-client.');
  const code = options.code && options.code !== true ? String(options.code).toUpperCase() : config.core.generateCode();
  const folder = config.core.folderName(slug, code);
  const ctx = options.local ? { portalUrl: withSlash(config.portalUrl || 'https://your-domain.com/') } : await context({ create: Boolean(options.createSite) });
  const portalPath = new URL(ctx.portalUrl).pathname;
  const basePath = `${portalPath}${config.projectsFolder}/${folder}/`;
  if (options.local && !config.portalUrl) {
    log(c.yellow('  Tip: set "portalUrl" in publish.config.json (e.g. https://preview.your-domain.com/) so links point to your server.'));
  }

  // Is there already a preview for this project ID?
  const localExisting = [...foldersIn(await localFiles(config), config).keys()].filter((f) => f.startsWith(slug + '_'));
  let remoteExisting = [];
  if (!options.local) remoteExisting = [...foldersIn(await listRemoteFiles(ctx.site), config).keys()].filter((f) => f.startsWith(slug + '_'));
  const existing = [...new Set([...localExisting, ...remoteExisting])].filter((f) => f !== folder);
  if (existing.length && !options.force) {
    throw new UserError(
      `A preview for "${slug}" already exists (${existing.join(', ')}).\n` +
      `  • New version, same link and passcode: node tools/publish.mjs update <source> --slug ${slug}\n` +
      '  • Replace it with a new passcode (the old one stops working): add --force'
    );
  }

  log(`\nPublishing ${c.bold(options.name)} (${slug}) …`);
  const { dir, notes } = await buildSource(source, basePath);
  const meta = buildMeta();
  await fsp.writeFile(path.join(dir, 'preview.json'), JSON.stringify(meta, null, 2) + '\n');

  let deploy = null;
  if (options.local) {
    const target = path.join(config.publicDir, config.projectsFolder, folder);
    if (options.dryRun) {
      note(notes, `--dry-run: would write ${toPosix(path.relative(ROOT, target))}/`);
    } else {
      for (const old of existing) {
        if (localExisting.includes(old)) fs.rmSync(path.join(config.publicDir, config.projectsFolder, old), { recursive: true, force: true });
      }
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(dir, target, { recursive: true });
      note(notes, `Written to ${toPosix(path.relative(ROOT, target))}/ – upload this folder with FileZilla into /${config.projectsFolder}/.`);
    }
  } else {
    for (const old of localExisting) {
      if (old === folder || options.dryRun) continue;
      fs.rmSync(path.join(config.publicDir, config.projectsFolder, old), { recursive: true, force: true });
      note(notes, `Deleted the local copy ${config.projectsFolder}/${old}/ (replaced) – commit this change.`);
    }
    const addFiles = new Map();
    for (const { abs, rel } of await walk(dir)) {
      addFiles.set(`/${config.projectsFolder}/${folder}/${rel}`, { sha: sha1(await fsp.readFile(abs)), abs });
    }
    ({ deploy } = await publish({
      site: ctx.site,
      title: `Preview: ${slug} (new)`,
      compose: (local, remote) => composeDeploy({ cfg: config, local, remote, drop: new Set(existing), addFolder: folder, addFiles })
    }));
  }
  return result({ action: 'add', slug, code, folder, meta, notes, deploy, portalUrl: ctx.portalUrl, update: false });
}

async function findExisting(slugOrFolder, ctx) {
  const wanted = String(slugOrFolder);
  const folders = new Set(foldersIn(await localFiles(config), config).keys());
  if (!options.local) for (const f of foldersIn(await listRemoteFiles(ctx.site), config).keys()) folders.add(f);
  const matches = [...folders].filter((f) => f === wanted || f.startsWith(config.core.slugify(wanted) + '_'));
  if (!matches.length) throw new UserError(`No preview found for "${wanted}". Use "list" to see all previews.`);
  if (matches.length > 1) throw new UserError(`"${wanted}" matches several previews: ${matches.join(', ')}. Pass the full folder name.`);
  return matches[0];
}

async function cmdUpdate() {
  const source = requireSource();
  const ref = options.slug && options.slug !== true ? options.slug : options.name;
  if (!ref || ref === true) throw new UserError('Missing --slug (the project ID of the existing preview).');
  const ctx = options.local ? { portalUrl: withSlash(config.portalUrl || 'https://your-domain.com/') } : await context();
  const folder = await findExisting(ref, ctx);
  const slug = FOLDER_RE.exec(folder)[1];
  const portalPath = new URL(ctx.portalUrl).pathname;
  const basePath = `${portalPath}${config.projectsFolder}/${folder}/`;
  const metaPath = `/${config.projectsFolder}/${folder}/preview.json`;
  const localMeta = path.join(config.publicDir, metaPath);
  let existing = null;
  if (fs.existsSync(localMeta)) existing = JSON.parse(fs.readFileSync(localMeta, 'utf8'));
  else if (!options.local) existing = await readRemoteFile(ctx.site, metaPath, ctx.portalUrl);

  log(`\nUpdating ${c.bold(folder)} …`);
  const { dir, notes } = await buildSource(source, basePath);
  if (!existing) note(notes, '⚠ Could not read the previous preview.json – only the values passed now are used.');
  const meta = buildMeta(existing || {});
  await fsp.writeFile(path.join(dir, 'preview.json'), JSON.stringify(meta, null, 2) + '\n');

  let deploy = null;
  if (options.local || fs.existsSync(path.join(config.publicDir, config.projectsFolder, folder))) {
    const target = path.join(config.publicDir, config.projectsFolder, folder);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(dir, target, { recursive: true });
    note(notes, `Updated ${toPosix(path.relative(ROOT, target))}/.`);
  }
  if (!options.local) {
    const addFiles = new Map();
    for (const { abs, rel } of await walk(dir)) {
      addFiles.set(`/${config.projectsFolder}/${folder}/${rel}`, { sha: sha1(await fsp.readFile(abs)), abs });
    }
    ({ deploy } = await publish({
      site: ctx.site,
      title: `Preview: ${slug} (update)`,
      compose: (local, remote) => composeDeploy({ cfg: config, local, remote, addFolder: folder, addFiles })
    }));
  }
  return result({ action: 'update', slug, code: null, folder, meta, notes, deploy, portalUrl: ctx.portalUrl, update: true });
}

async function cmdRemove() {
  const ref = options._[1] || options.slug;
  if (!ref || ref === true) throw new UserError('Which preview? node tools/publish.mjs remove <project-id>');
  const ctx = await context();
  const folder = await findExisting(ref, ctx);
  const localDir = path.join(config.publicDir, config.projectsFolder, folder);
  if (fs.existsSync(localDir) && !options.dryRun) {
    fs.rmSync(localDir, { recursive: true, force: true });
    log(c.dim(`  Deleted the local copy ${toPosix(path.relative(ROOT, localDir))}/ – commit this change.`));
  }
  log(`Taking ${c.bold(folder)} offline …`);
  const { deploy } = await publish({
    site: ctx.site,
    title: `Preview removed: ${folder}`,
    compose: (local, remote) => composeDeploy({ cfg: config, local, remote, drop: new Set([folder]) })
  });
  if (deploy) log(`${c.green('✔')} ${folder} is offline. Its link and passcode no longer work.`);
  return { action: 'remove', folder, deployId: deploy && deploy.id };
}

async function cmdList() {
  const ctx = await context();
  const remote = await listRemoteFiles(ctx.site);
  const folders = foldersIn(remote, config);
  const rows = [];
  for (const [folder, count] of [...folders].sort()) {
    const meta = (await readRemoteFile(ctx.site, `/${config.projectsFolder}/${folder}/preview.json`, ctx.portalUrl)) || {};
    const slug = FOLDER_RE.exec(folder)[1];
    rows.push({
      slug,
      folder,
      files: count,
      customer: pick(meta.customer, 'de') || '',
      title: pick(meta.title, 'de') || '',
      version: pick(meta.version, 'de') || '',
      updated: meta.updated || '',
      link: `${ctx.portalUrl}?p=${slug}`
    });
  }
  if (!options.json) {
    log(`${c.bold(ctx.site.name)} – ${ctx.portalUrl}\n`);
    if (!rows.length) log('No client previews online yet.');
    for (const r of rows) {
      log(`${c.bold(r.customer || r.slug)}  ${c.dim(r.title)} ${r.version ? '· ' + r.version : ''} ${r.updated ? c.dim('· ' + r.updated) : ''}`);
      log(`  ${r.link}   ${c.dim(r.folder + ' · ' + r.files + ' files')}`);
    }
    log(c.dim('\nPasscodes are never stored. Lost one? Publish again with "add --force" to set a new passcode.'));
  }
  return { portalUrl: ctx.portalUrl, projects: rows };
}

function result({ action, slug, code, folder, meta, notes, deploy, portalUrl, update }) {
  const link = `${portalUrl}?p=${slug}`;
  const magicLink = code ? `${link}#code=${config.core.normalizeCode(code)}` : null;
  const lang = options.lang === 'en' ? 'en' : 'de';
  const customer = pick(meta.customer, lang) || slug;
  const message = clientMessage({ lang, customer, title: pick(meta.title, lang), link, code, update });
  const out = {
    ok: true,
    action,
    slug,
    folder,
    link,
    code,
    magicLink,
    portalUrl,
    local: Boolean(options.local),
    deployId: deploy ? deploy.id : null,
    notes,
    message
  };
  if (!options.json) {
    const where = options.local ? 'is ready for upload' : 'is online';
    log(`\n${c.green('✔')} ${c.bold(customer)} ${where}${options.dryRun ? c.yellow(' (dry run)') : ''}`);
    log(`  Link:        ${link}`);
    if (code) log(`  Passcode:    ${c.bold(code)}   ${c.dim('(stored nowhere – note it down)')}`);
    else log(`  Passcode:    ${c.dim('unchanged')}`);
    if (magicLink) log(`  Direct link: ${c.dim(magicLink)}`);
    log(`  Folder:      ${config.projectsFolder}/${folder}`);
    log(`\n${c.bold('Message for the client')}\n${'─'.repeat(60)}\n${message}\n${'─'.repeat(60)}`);
  }
  return out;
}

const HELP = `
${'Preview Portal – publish client previews'}

Usage
  node tools/publish.mjs setup [--site <netlify-site-name>]
  node tools/publish.mjs portal
  node tools/publish.mjs add <source> --name "Café Alma" [options]
  node tools/publish.mjs update <source> --slug cafe-alma [options]
  node tools/publish.mjs list
  node tools/publish.mjs remove <project-id>

<source>  a Vite project (built automatically) or a finished website folder (use --no-build)

Options for add / update
  --name "…"         client name shown in the welcome screen
  --slug id          project ID used in the link (default: from --name)
  --code XXXX-XXXX   passcode (add only; default: a new random one)
  --title "…"        project title, e.g. "Website-Relaunch"
  --version "…"      version label, e.g. "Entwurf 2"
  --note "…"         personal note shown to the client
  --changes "A|B"    "What's new" list, separated by |
  --pages "Start=/|Über uns=ueber-uns"   entries for the pages menu
  --domain host      future domain shown in the address bar
  --device desktop|tablet|mobile         initial device frame
  --no-build         publish <source> as it is (must be a finished site)
  --force            add: replace an existing preview with a new passcode
  --local            write into public/projects/ instead of deploying (FileZilla workflow)
  --lang en          client message in English (default: German)
  --dry-run          show what would change, upload nothing
  --json             machine-readable output

Environment
  NETLIFY_AUTH_TOKEN   Netlify personal access token (required except for --local)
  NETLIFY_SITE_ID      overrides "netlifySite" from publish.config.json
`;

/* ───────────────────────── main ───────────────────────── */

const options = parseArgs(process.argv.slice(2));
let config;

async function main() {
  const command = options._[0];
  if (!command || options.help) {
    console.log(HELP);
    return;
  }
  config = loadConfig();
  const commands = { setup: cmdSetup, portal: cmdPortal, add: cmdAdd, update: cmdUpdate, list: cmdList, remove: cmdRemove };
  if (!commands[command]) throw new UserError(`Unknown command "${command}". Run with --help.`);
  const output = await commands[command]();
  if (options.json) console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  if (options.json) {
    console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
  } else {
    console.error(`\n${c.red('✖')} ${err instanceof UserError ? err.message : err.stack || err.message}`);
  }
  process.exit(1);
});
