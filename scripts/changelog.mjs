#!/usr/bin/env node
// Builds Arro's changelog from its GitHub releases.
//
//   node scripts/changelog.mjs            fetch from the GitHub API
//   node scripts/changelog.mjs --from f   read a saved `gh api .../releases` JSON file
//
// Writes data/arro-releases.json and refreshes the generated blocks in the
// HTML pages (the release list, the download table and every
// `data-arro-version` / `data-arro-date` element). No dependencies; Node 18+.
// A token from GITHUB_TOKEN, GH_TOKEN or `gh auth token` is used when present,
// otherwise the public API (60 requests an hour) is enough.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "PabloSensei/arro";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "arro-releases.json");

// ---------------------------------------------------------------- fetch

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

async function fetchReleases() {
  const auth = token();
  const all = [];
  for (let page = 1; page < 50; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "changelog-script",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

// ---------------------------------------------------------------- markdown

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(md) {
  const code = [];
  let s = md.replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g, (_, p, u) => `${p}<a href="${u}">${u.replace(/^https?:\/\//, "")}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(code[+i])}</code>`);
  return s;
}

const plain = (md) => md.replace(/`([^`]+)`/g, "$1").replace(/\*\*|\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

// Which bucket a "### Heading" belongs to.
function kindOf(title) {
  const t = title.toLowerCase();
  if (/^(new|highlights|added)/.test(t)) return "new";
  if (/^fix/.test(t)) return "fixed";
  if (/under the hood|internal/.test(t)) return "hood";
  if (/known limitations/.test(t)) return "limits";
  if (/^install|^download/.test(t)) return "skip";
  return "improved";
}

// Boilerplate lines that every release repeats; the site shows them once elsewhere.
const BOILERPLATE = [/^>\s*\*\*early preview\.\*\*/i, /^please report problems/i];

function parseBody(body) {
  const lines = body.replace(/\r/g, "").split("\n");
  const summary = [];
  const notes = [];
  const sections = [];
  let current = null;
  let skipping = false;
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ").trim();
    para = [];
    if (!text || skipping) return;
    if (current) current.items.push({ html: inline(text), text: plain(text), para: true });
    else summary.push(inline(text));
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s/.test(line)) { flushPara(); continue; }
    const h = line.match(/^###+\s+(.*)$/);
    if (h) {
      flushPara();
      const kind = kindOf(h[1].trim());
      skipping = kind === "skip";
      current = skipping ? null : { kind, title: h[1].trim(), items: [] };
      if (current) sections.push(current);
      continue;
    }
    if (BOILERPLATE.some((re) => re.test(line))) { flushPara(); continue; }
    if (skipping) continue;
    if (/^>/.test(line)) {
      flushPara();
      const text = line.replace(/^>\s?/, "");
      if (text.trim()) {
        if (notes.length && !/^\*\*/.test(text)) notes[notes.length - 1] += " " + inline(text);
        else notes.push(inline(text));
      }
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      flushPara();
      if (!current) { current = { kind: "new", title: "Highlights", items: [] }; sections.push(current); }
      const text = li[1];
      const lead = text.match(/^\*\*(.+?)\*\*:?\s*/);
      current.items.push({
        html: inline(text),
        text: plain(text),
        lead: lead ? plain(lead[1]).replace(/[.:]$/, "") : null,
      });
      continue;
    }
    if (!line.trim()) { flushPara(); continue; }
    if (current && current.items.length && !current.items.at(-1).para && /^\s{2,}/.test(raw)) {
      const it = current.items.at(-1);
      it.html += " " + inline(line.trim());
      it.text += " " + plain(line.trim());
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return { summary, notes, sections: sections.filter((s) => s.items.length) };
}

// ---------------------------------------------------------------- assets

function describeAsset(a) {
  const n = a.name;
  if (n.endsWith(".sha256")) return null;
  let os = null, label = null, order = 9;
  if (/windows/.test(n) && n.endsWith(".zip")) { os = "windows"; label = "Windows 11 · x86-64 · zip"; order = 0; }
  else if (n.endsWith(".deb")) { os = "linux"; label = "Debian, Ubuntu · .deb"; order = 1; }
  else if (n.endsWith(".rpm")) { os = "linux"; label = "Fedora, RHEL, openSUSE · .rpm"; order = 2; }
  else if (/linux/.test(n) && n.endsWith(".tar.gz")) { os = "linux"; label = "Any glibc 2.35+ distro · tar.gz"; order = 3; }
  else if (n.endsWith(".dmg")) { os = "macos"; label = "Apple silicon · .dmg"; order = 4; }
  else if (/macos/.test(n) && n.endsWith(".zip")) { os = "macos"; label = "Apple silicon · zip"; order = 5; }
  if (/macos-x86_64/.test(n)) label = label.replace("Apple silicon", "Intel");
  if (!os) return null;
  return { name: n, os, label, order, size: a.size, url: a.browser_download_url };
}

// ---------------------------------------------------------------- build

function build(releases) {
  const list = releases
    .filter((r) => !r.draft)
    .map((r) => {
      const version = (r.tag_name || r.name).replace(/^v/, "");
      const body = parseBody(r.body || "");
      const counts = { new: 0, improved: 0, fixed: 0, hood: 0, limits: 0 };
      for (const s of body.sections) counts[s.kind] += s.items.length;
      return {
        version,
        tag: r.tag_name,
        date: r.published_at,
        url: r.html_url,
        prerelease: r.prerelease,
        ...body,
        counts,
        assets: r.assets.map(describeAsset).filter(Boolean).sort((a, b) => a.order - b.order),
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = list.find((r) => !r.prerelease) || list[0];
  return {
    repo: REPO,
    generatedAt: new Date().toISOString(),
    latest: { version: latest.version, tag: latest.tag, date: latest.date, url: latest.url, assets: latest.assets },
    releases: list,
  };
}

// ---------------------------------------------------------------- static HTML

const KIND_TITLE = { new: "New", improved: "Improved", fixed: "Fixed", hood: "Under the hood", limits: "Known limitations" };
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtSize = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : Math.round(b / 1e6) + " MB");

function renderRelease(r, i) {
  const id = `v${r.version}`;
  const total = r.counts.new + r.counts.improved + r.counts.fixed + r.counts.hood;
  const sections = r.sections
    .map((s) => {
      const label = s.title.toLowerCase() === KIND_TITLE[s.kind].toLowerCase() || s.kind === "new" ? KIND_TITLE[s.kind] : s.title;
      const items = s.items
        .map((it) => `<li data-text="${esc(it.text.toLowerCase())}">${it.html}</li>`)
        .join("\n          ");
      return `
      <section class="rel-group" data-kind="${s.kind}">
        <h3><span class="kind-mark" aria-hidden="true"></span>${esc(label)} <span class="count">${s.items.length}</span></h3>
        <ul>
          ${items}
        </ul>
      </section>`;
    })
    .join("");
  const notes = r.notes.map((n) => `<p class="rel-note">${n}</p>`).join("");
  return `
    <article class="release${i === 0 ? " is-latest" : ""}" id="${id}" data-version="${r.version}" data-total="${total}">
      <header class="rel-head">
        <a class="rel-anchor" href="#${id}" aria-label="Link to Arro ${r.version}">#</a>
        <h2><span class="rel-name">Arro</span> ${r.version}</h2>
        <p class="rel-meta"><time datetime="${r.date}">${fmtDate(r.date)}</time>${i === 0 ? ' <span class="tag-latest">Latest</span>' : ""} · <a href="${r.url}">Release page</a></p>
      </header>
      ${r.summary.map((p) => `<p class="rel-summary">${p}</p>`).join("")}${notes}${sections}
    </article>`;
}

function renderDownloads(latest) {
  const groups = { windows: "Windows", linux: "Linux", macos: "macOS" };
  return Object.entries(groups)
    .map(([os, title]) => {
      const rows = latest.assets
        .filter((a) => a.os === os)
        .map(
          (a) => `
          <li><a class="dl" href="${a.url}"><span class="dl-label">${esc(a.label)}</span><span class="dl-file">${esc(a.name)}</span><span class="dl-size">${fmtSize(a.size)}</span></a></li>`
        )
        .join("");
      return `
      <div class="dl-os" data-os="${os}">
        <h3>${title}</h3>
        <ul>${rows || '\n          <li class="dl-none">No build in this release.</li>'}
        </ul>
      </div>`;
    })
    .join("");
}

function replaceBlock(html, name, content) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  return re.test(html) ? html.replace(re, `$1${content}\n    $2`) : html;
}

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || ["node_modules", "scripts", "data", "assets"].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

async function updatePages(data) {
  const shortDate = new Date(data.latest.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  for (const file of await htmlFiles(ROOT)) {
    let html = await readFile(file, "utf8");
    const before = html;
    html = html.replace(/(<[^>]+data-arro-version[^>]*>)[^<]*(<\/)/g, `$1${data.latest.version}$2`);
    html = html.replace(/(<[^>]+data-arro-date[^>]*>)[^<]*(<\/)/g, `$1${shortDate}$2`);
    html = html.replace(/(<[^>]+data-arro-count[^>]*>)[^<]*(<\/)/g, `$1${data.releases.length}$2`);
    html = replaceBlock(html, "releases", data.releases.map(renderRelease).join("\n"));
    html = replaceBlock(html, "downloads", renderDownloads(data.latest));
    if (html !== before) {
      await writeFile(file, html);
      console.log("updated", file.slice(ROOT.length + 1));
    }
  }
}

// ---------------------------------------------------------------- main

const fromIdx = process.argv.indexOf("--from");
const releases = fromIdx > 0 ? JSON.parse(await readFile(process.argv[fromIdx + 1], "utf8")) : await fetchReleases();
const data = build(releases);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data, null, 1) + "\n");
console.log(`wrote data/arro-releases.json: ${data.releases.length} releases, latest ${data.latest.version}`);
await updatePages(data);
