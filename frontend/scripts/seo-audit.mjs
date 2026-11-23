#!/usr/bin/env node
// Checks every sitemap URL for what Google needs: a 200 status, a unique title, a meta
// description of 120 to 160 characters, a self-referencing canonical and no noindex.
// It also checks that sign-in and checkout pages carry noindex and stay out of the sitemap.
//
// Usage: node scripts/seo-audit.mjs [base-url] [--json out.json]
// Exit code 1 when any check fails.

const args = process.argv.slice(2);
const jsonIndex = args.indexOf("--json");
const jsonOut = jsonIndex >= 0 ? args[jsonIndex + 1] : null;
const base = (args.find((a, i) => !a.startsWith("--") && i !== jsonIndex + 1) || "https://www.edorax.com").replace(/\/$/, "");

// Pages that must never be indexed or listed.
const PRIVATE_PATHS = ["/login", "/signup", "/verify-email", "/courses/dw-level-1/checkout"];
const MIN = 120;
const MAX = 160;

function decode(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .trim();
}

function head(html) {
  const end = html.indexOf("</head>");
  return end > 0 ? html.slice(0, end) : html;
}

function metaContent(html, name) {
  const tags = head(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const n = tag.match(/\bname="([^"]*)"/i)?.[1];
    if (n && n.toLowerCase() === name) return decode(tag.match(/\bcontent="([^"]*)"/i)?.[1] ?? "");
  }
  return null;
}

function parse(html) {
  const h = head(html);
  const title = decode(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, "description");
  const robots = metaContent(html, "robots");
  const canonical = h.match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0].match(/href="([^"]*)"/i)?.[1] ?? null;
  const ldTypes = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data["@graph"] || [data];
      return items.map((item) => item["@type"]);
    } catch {
      return ["(invalid)"];
    }
  });
  const nosnippet = (html.match(/data-nosnippet/g) || []).length;
  return { title, description, robots, canonical: canonical ? decode(canonical) : null, ldTypes, nosnippet };
}

async function get(url) {
  const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) edorax-seo-audit" } });
  const html = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), xRobots: res.headers.get("x-robots-tag"), html };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const sitemapRes = await fetch(`${base}/sitemap.xml`);
const sitemapXml = await sitemapRes.text();
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => decode(m[1]));
const robotsTxt = await (await fetch(`${base}/robots.txt`)).text();

// The sitemap lists production URLs; when auditing a local build, fetch the same path locally.
const toLocal = (url) => base + new URL(url).pathname + new URL(url).search;

const rows = await pool(sitemapUrls, 6, async (url) => {
  const r = await get(toLocal(url));
  return { url, path: new URL(url).pathname + new URL(url).search, status: r.status, ...parse(r.html) };
});

const titleCount = new Map();
const descCount = new Map();
for (const r of rows) {
  titleCount.set(r.title, (titleCount.get(r.title) || 0) + 1);
  if (r.description) descCount.set(r.description, (descCount.get(r.description) || 0) + 1);
}

let failures = 0;
for (const r of rows) {
  const problems = [];
  if (r.status !== 200) problems.push(`status ${r.status}`);
  if (!r.title) problems.push("no title");
  else if (titleCount.get(r.title) > 1) problems.push("duplicate title");
  const len = r.description?.length ?? 0;
  if (!r.description) problems.push("no description");
  else if (len < MIN || len > MAX) problems.push(`description ${len} chars`);
  else if (descCount.get(r.description) > 1) problems.push("duplicate description");
  const same = (a, b) => a && b && a.replace(/\/$/, "") === b.replace(/\/$/, "");
  if (!same(r.canonical, r.url)) problems.push(`canonical ${r.canonical ?? "missing"}`);
  if (r.robots && /noindex/i.test(r.robots)) problems.push("noindex");
  r.problems = problems;
  if (problems.length) failures++;
}

const privateRows = await pool(PRIVATE_PATHS, 4, async (path) => {
  const r = await get(base + path);
  const p = parse(r.html);
  const problems = [];
  const noindex = /noindex/i.test(p.robots ?? "") || /noindex/i.test(r.xRobots ?? "");
  if (r.status === 200 && !noindex) problems.push("indexable");
  if (sitemapUrls.some((u) => new URL(u).pathname === path)) problems.push("in sitemap");
  if (problems.length) failures++;
  return { path, status: r.status, title: p.title, robots: p.robots ?? r.xRobots, problems };
});

const home = rows.find((r) => r.path === "/");
const homeLd = home?.ldTypes ?? [];
const ldProblems = ["WebSite", "Organization"].filter((t) => !homeLd.includes(t));
if (ldProblems.length) failures++;

const pad = (s, n) => String(s).padEnd(n);
console.log(`SEO audit of ${base} (${rows.length} sitemap URLs)\n`);
console.log(`${pad("path", 46)} ${pad("st", 4)} ${pad("desc", 5)} ${pad("nosnip", 7)} ${pad("title", 60)} problems`);
for (const r of rows) {
  console.log(`${pad(r.path, 46)} ${pad(r.status, 4)} ${pad(r.description?.length ?? "-", 5)} ${pad(r.nosnippet, 7)} ${pad(r.title.slice(0, 58), 60)} ${r.problems.join("; ") || "ok"}`);
}
console.log(`\nPages that must stay out of the index:`);
for (const r of privateRows) {
  console.log(`${pad(r.path, 46)} ${pad(r.status, 4)} robots=${pad(r.robots ?? "-", 20)} ${r.problems.join("; ") || "ok"}`);
}
console.log(`\nHome structured data: ${homeLd.join(", ") || "none"}${ldProblems.length ? `  MISSING ${ldProblems.join(", ")}` : ""}`);
console.log(`robots.txt disallows: ${robotsTxt.match(/^Disallow:.*$/gim)?.map((l) => l.slice(9).trim()).join(" ") ?? "-"}`);
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} failing check(s).`}`);

if (jsonOut) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(jsonOut, JSON.stringify({ base, rows, privateRows, homeLd }, null, 2));
}
process.exit(failures === 0 ? 0 : 1);
