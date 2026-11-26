#!/usr/bin/env node
// Builds dist/: home, a page per collection and per session, and the data downloads
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { DATA_DIR, OUT_DIR, STATIC_DIR } from "./config.js";
import { load } from "./records.js";
import { dublinCore } from "./dublin-core.js";
import { createHash } from "node:crypto";
import { home, collectionPage, sessionPage, wordlistPage, aboutPage, dataPage, csvRows } from "./pages.js";

function write(rel, content) {
  const full = join(OUT_DIR, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

// browsers only take WebVTT for <track>
function toVtt(srt) {
  return "WEBVTT\n\n" + srt.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
}

const { collections: all, items, errors } = load(DATA_DIR);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const collections = all.filter((c) => c.sessions.length).sort((a, b) => a.language.localeCompare(b.language));

rmSync(OUT_DIR, { recursive: true, force: true });
for (const name of readdirSync(STATIC_DIR)) write(name, readFileSync(join(STATIC_DIR, name)));

const places = collections.map((c) => ({ iso: c.iso, name: c.language, at: c.map, items: c.sessions.reduce((n, s) => n + s.items.length, 0) }));
write("index.html", home(collections, places));
write("about/index.html", aboutPage(collections));
write("data/index.html", dataPage(collections, items.length));

// the two-letter folder Commons keeps a file in, from the md5 of its name
const folder = (name) => createHash("md5").update(name.replaceAll(" ", "_")).digest("hex").slice(0, 2);

for (const c of collections) {
  write(`${c.iso}/index.html`, collectionPage(c, collections));
  for (const w of c.wordlists) {
    write(`${w.id}/index.html`, wordlistPage(w, collections));
    write(`${w.id}/words.json`, JSON.stringify(w.words.map((x) => [x.n, x.word, x.file, folder(x.file)])));
    write(`${w.id}/${w.id}.csv`, readFileSync(join(DATA_DIR, c.iso, "words", `${w.key}.csv`)));
  }
  for (const s of c.sessions) {
    write(`${s.id}/index.html`, sessionPage(s, collections));
    for (const it of s.items) {
      write(`${s.id}/${it.id}.json`, it.raw);
      write(`${s.id}/${it.id}.dc.xml`, dublinCore(it));
      for (const sub of it.subtitles) {
        write(`${s.id}/${sub.file}`, sub.text);
        write(`${s.id}/${it.id}.${sub.language}.vtt`, toVtt(sub.text));
      }
    }
  }
}

write("data/records.json", JSON.stringify(Object.fromEntries(items.map((it) => [it.id, it.tome])), null, 2) + "\n");
write("data/records.csv", csvRows(items));
const dc = items.map((it) => dublinCore(it).replace(/^<\?xml[^>]*>\n/, "").replace(/^/gm, "  ").trimEnd());
write("data/dublin-core.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${dc.join("\n")}\n</records>\n`);

const subs = items.reduce((n, it) => n + it.subtitles.length, 0);
console.log(`Built ${collections.length} collections, ${collections.reduce((n, c) => n + c.sessions.length, 0)} sessions, ${items.length} items, ${subs} subtitle files.`);
