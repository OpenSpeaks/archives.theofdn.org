#!/usr/bin/env node
// npm run new, ia, stage, update, webm. See CONTRIBUTING, "Add a recording"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DATA_DIR, ROOT, arkUrl, ARK_NAAN, ARK_SHOULDER } from "./config.js";
import { ITEM_ID, SESSION_DIR, isoOf, peopleOf } from "./records.js";

// media and drafts wait here, outside the repo
const INCOMING = resolve(process.env.OSA_INCOMING || join(ROOT, "..", "incoming"));
const UA = { "User-Agent": "OpenSpeaksArchivesBuild/0.1 (https://theofdn.org/openspeaks/)" };
const MEDIA = /\.(mov|mp4|m4v|mkv|webm|avi|mts|wav|mp3|m4a|flac|ogg|opus)$/i;

const fail = (msg) => { console.error(msg); process.exit(1); };
const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : []);
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
// Tome saves 2 spaces and no newline at the end
const writeJSON = (p, t) => writeFileSync(p, JSON.stringify(t, null, 2));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.error) fail(`${cmd}: ${r.error.message}`);
  return r.status === 0;
}

function parseId(id) {
  const m = ITEM_ID.exec(id || "");
  if (!m) fail(`give an item id, such as kip002`);
  return m[1];
}

// incoming/<iso>/r<n>/<id>/
function draftDir(id) {
  const iso = parseId(id);
  for (const s of dirs(join(INCOMING, iso))) if (existsSync(join(INCOMING, iso, s, id))) return { iso, session: s, dir: join(INCOMING, iso, s, id) };
}

// data/<iso>/r<n>/<id>.json
function stored(id) {
  const iso = parseId(id);
  for (const s of dirs(join(DATA_DIR, iso)).filter((d) => SESSION_DIR.test(d))) {
    const path = join(DATA_DIR, iso, s, id + ".json");
    if (existsSync(path)) return { iso, session: s, dir: join(DATA_DIR, iso, s), path };
  }
}

function numbersIn(base, iso) {
  const found = [];
  for (const s of dirs(base).filter((d) => SESSION_DIR.test(d))) {
    for (const f of readdirSync(join(base, s))) {
      const m = ITEM_ID.exec(f.replace(/\.json$/, ""));
      if (m && m[1] === iso) found.push({ session: s, n: Number(m[2]) });
    }
  }
  return found;
}

async function wikidataLanguage(iso) {
  const q = `SELECT ?l ?lLabel WHERE { ?l wdt:P220 "${iso}" . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 1`;
  try {
    const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: UA });
    const b = (await r.json()).results.bindings[0];
    return b ? { qid: b.l.value.split("/").pop(), name: b.lLabel.value } : {};
  } catch {
    return {};
  }
}

// npm run new kip      -> new session
// npm run new kip r1   -> another item in session r1
async function newItem(iso, session) {
  if (!/^[a-z]{3}$/.test(iso || "")) fail("give the language code, such as kip, and a session if it joins one, such as r1");
  const col = join(DATA_DIR, iso);
  if (!existsSync(join(col, "collection.json"))) {
    const lang = await wikidataLanguage(iso);
    mkdirSync(col, { recursive: true });
    writeJSON(join(col, "collection.json"), { languageISO: iso, language: lang.name || "", wikidata: lang.qid || "", place: "", map: [], deposits: [] });
    console.log(`New language. Fill "language", "place" and "map" [latitude, longitude] in data/${iso}/collection.json.`);
    if (lang.qid) console.log(`Wikidata says ${iso} is ${lang.name} (${lang.qid}).`);
  }
  const taken = [...numbersIn(col, iso), ...numbersIn(join(INCOMING, iso), iso)];
  for (const s of dirs(join(INCOMING, iso))) for (const d of dirs(join(INCOMING, iso, s))) {
    const m = ITEM_ID.exec(d);
    if (m && m[1] === iso) taken.push({ session: s, n: Number(m[2]) });
  }
  const n = Math.max(0, ...taken.map((x) => x.n)) + 1;
  const sessions = new Set([...dirs(col), ...dirs(join(INCOMING, iso))].filter((d) => SESSION_DIR.test(d)));
  if (session && !SESSION_DIR.test(session)) fail("sessions are named r1, r2, r3");
  const s = session || "r" + (Math.max(0, ...[...sessions].map((d) => Number(d.slice(1)))) + 1);
  const id = iso + String(n).padStart(3, "0");
  const dir = join(INCOMING, iso, s, id);
  mkdirSync(dir, { recursive: true });
  console.log(`\n${id}, session ${s}\n\nPut its files in\n  ${dir}\n\nnamed ${id}.mov (or .mp4, .wav), ${id}.<language code>.srt for each subtitle, and the Tome record as ${id}.json.`);
}

const ROLE_CREATOR = ["speaker", "interviewee", "singer", "performer", "copyright"];
const LICENCES = {
  "cc-by-sa-4.0": ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
  "cc-by-4.0": ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  "cc-by-sa-3.0": ["CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"],
  "cc-by-3.0": ["CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"],
  "cc-zero": ["CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"],
};

const iaIdOf = (t, id) => (t.identifiers || []).find((i) => i.prop === "P724" && i.value?.trim())?.value.trim() || ARK_SHOULDER + id;

function iaMetadata(t, id) {
  const people = peopleOf(t);
  const creators = people.filter((p) => p.roles.some((r) => ROLE_CREATOR.includes(r))).map((p) => p.name);
  // roles from People, then subtitle credits written as "Name (subtitler), Name2 (editor)"
  const roles = new Map(people.map((p) => [p.name, new Set(p.roles)]));
  const credits = [t.subtitleCreators, t.subtitleEditorsReviewers, ...(t.additionalSubtitles || []).flatMap((s) => [s.creators, s.editorsReviewers])];
  for (const m of credits.filter(Boolean).join(", ").matchAll(/([^,;()]+?)\s*\(([^)]+)\)/g)) {
    const name = m[1].trim();
    if (!roles.has(name)) roles.set(name, new Set());
    for (const r of m[2].split(/,\s*/)) roles.get(name).add(r.trim().toLowerCase());
  }
  const contributors = [...roles].map(([name, set]) => [name, [...set].filter((r) => r !== "credited" && !ROLE_CREATOR.includes(r))]).filter(([, r]) => r.length).map(([name, r]) => `${name} (${r.join(", ")})`);
  const holders = people.filter((p) => p.roles.includes("copyright")).map((p) => p.name);
  const [licence, licenceUrl] = LICENCES[t.license] || [];
  const year = String(t.date || t.year || "").slice(0, 4);
  const video = t.fileType === "video";
  const item = t.wikidata?.item;
  const md = {
    mediatype: video ? "movies" : "audio",
    collection: video ? "opensource_movies" : "opensource_audio",
    title: t.title,
    description: t.description,
    date: t.date || t.year,
    language: t.language,
    subject: [...new Set([t.language, t.dialect, t.projectName, "OpenSpeaks Archives", ...(t.keywords || [])].filter(Boolean))],
    coverage: [t.recordingPlace, t.country].filter(Boolean).join(", "),
    creator: creators,
    contributor: contributors,
    rights: holders.length && licence ? `© ${year ? year + " " : ""}${holders.join(", ")}. Licence: ${licence}` : "",
    licenseurl: licenceUrl,
    publisher: "OpenSpeaks Archives",
    source: arkUrl(id),
    "external-identifier": [`urn:ark:${ARK_NAAN}/${ARK_SHOULDER}${id}`, item && `urn:wikidata:${item}`].filter(Boolean),
  };
  return Object.fromEntries(Object.entries(md).filter(([, v]) => (Array.isArray(v) ? v.length : v)));
}

function metadataArgs(md, flag) {
  return Object.entries(md).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).flatMap((x) => [flag, `${k}:${x}`]));
}

// npm run ia kip002 [go]           upload a new item
// npm run ia kip001 update [go]  rewrite an item's metadata from the archive's record
function ia(id, flags) {
  const go = flags.includes("go");
  if (flags.includes("update")) {
    const s = stored(id) || fail(`${id} isn't in data/ yet`);
    const t = readJSON(s.path);
    const ident = iaIdOf(t, id);
    const { mediatype, collection, ...md } = iaMetadata(t, id);
    const args = ["metadata", ident, ...metadataArgs(md, "--modify")];
    console.log(JSON.stringify({ identifier: ident, ...md }, null, 2));
    if (!go) return console.log("\nDry run. Add go to change the Internet Archive item.");
    if (run("ia", args)) console.log(`https://archive.org/details/${ident}`);
    return;
  }
  const d = draftDir(id) || fail(`no folder for ${id}; run npm run new first`);
  const recordPath = join(d.dir, id + ".json");
  if (!existsSync(recordPath)) fail(`save the Tome record as ${recordPath}`);
  const t = readJSON(recordPath);
  for (const f of ["title", "license", "fileType"]) if (!t[f]) fail(`${id}.json: "${f}" is empty`);
  const names = readdirSync(d.dir).filter((f) => f.startsWith(id + "."));
  let media = names.filter((f) => MEDIA.test(f));
  // the WebM is for commons, IA makes its own copies from the original
  if (media.length > 1) media = media.filter((f) => !/\.webm$/i.test(f));
  if (!media.length) fail(`put the recording in ${d.dir} as ${id}.mov (or .mp4, .wav)`);
  const subs = names.filter((f) => f.endsWith(".srt"));
  const ident = iaIdOf(t, id);
  const md = iaMetadata(t, id);
  console.log(JSON.stringify({ identifier: ident, files: [...media, ...subs], ...md }, null, 2));
  if (!go) return console.log("\nDry run. Add go to upload.");
  if (!run("ia", ["upload", ident, ...media, ...subs, "--retries", "10", ...metadataArgs(md, "--metadata")], { cwd: d.dir })) fail("upload stopped; run the same command again to carry on");
  const ids = (t.identifiers ||= []);
  if (!ids.some((i) => i.prop === "P724")) ids.push({ prop: "P724", label: "Internet Archive ID", value: ident });
  writeJSON(recordPath, t);
  console.log(`\nhttps://archive.org/details/${ident}\nNext: npm run stage ${id}`);
}

// the playable copy: IA's h.264 when it has made one, else the original
async function iaFileUrl(ident) {
  try {
    const r = await fetch(`https://archive.org/metadata/${ident}`, { headers: UA });
    const files = (await r.json()).files || [];
    const pick = files.find((f) => f.format === "h.264") || files.find((f) => /\.(mp4|webm|mp3|ogg)$/i.test(f.name) && f.source === "original") || files.find((f) => MEDIA.test(f.name) && f.source === "original");
    return pick ? `https://archive.org/download/${ident}/${encodeURIComponent(pick.name)}` : "";
  } catch {
    return "";
  }
}

async function commonsHas(fileName) {
  const r = await fetch("https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=" + encodeURIComponent("File:" + fileName), { headers: UA });
  const pages = Object.values((await r.json()).query?.pages || {});
  return pages.length > 0 && !("missing" in pages[0]);
}

async function refreshLinks(t, id) {
  const ident = (t.identifiers || []).find((i) => i.prop === "P724")?.value;
  if (ident && (!t.fileUrl || /archive\.org/.test(t.fileUrl))) {
    const url = await iaFileUrl(ident);
    if (url && url !== t.fileUrl) { t.fileUrl = url; console.log(`fileUrl: ${url}`); }
    if (!url) console.log("The Internet Archive copy isn't ready yet. Run npm run update " + id + " later.");
  }
  if (!t.firstPublishedUrl) t.firstPublishedUrl = arkUrl(id);
  if (!t.firstPublishedBy) t.firstPublishedBy = "OpenSpeaks Archives";
  if (t.fileName) {
    const name = t.fileName.replace(/^File:/i, "");
    const on = await commonsHas(name).catch(() => t.onCommons);
    if (on !== t.onCommons) console.log(on ? `On Commons: ${name}` : `Not on Commons yet: ${name}`);
    t.onCommons = on;
  }
}

function check() {
  return run("node", [join(ROOT, "scripts", "validate.js")]) && run("node", [join(ROOT, "scripts", "build.js")]);
}

// npm run stage kip002
async function stage(id) {
  const d = draftDir(id) || fail(`no folder for ${id}; run npm run new first`);
  if (stored(id)) fail(`${id} is already in the archive. Use npm run update ${id}`);
  const recordPath = join(d.dir, id + ".json");
  if (!existsSync(recordPath)) fail(`save the Tome record as ${recordPath}`);
  const t = readJSON(recordPath);
  if (isoOf(t) && isoOf(t) !== d.iso) fail(`${id}.json: languageISO is "${isoOf(t)}", the folder is ${d.iso}`);
  await refreshLinks(t, id);
  const out = join(DATA_DIR, d.iso, d.session);
  mkdirSync(out, { recursive: true });
  writeJSON(join(out, id + ".json"), t);
  writeJSON(recordPath, t);
  const subs = readdirSync(d.dir).filter((f) => f.startsWith(id + ".") && f.endsWith(".srt"));
  for (const f of subs) copyFileSync(join(d.dir, f), join(out, f));
  console.log(`Copied ${id}.json and ${subs.length} subtitle file(s) to data/${d.iso}/${d.session}/.`);
  if (!check()) fail("\nFix what's listed above, then run npm run update " + id);
  console.log(`\nLook at it: npm run serve, then open http://127.0.0.1:8765/${d.iso}-${d.session}/#${id}\nPublish: npm run push "add ${id}"`);
}

// fields that only change once the file is on Commons and Wikidata
function merge(t, fresh) {
  const changed = [];
  const take = (k) => { if (fresh[k] !== undefined && JSON.stringify(fresh[k]) !== JSON.stringify(t[k])) { t[k] = fresh[k]; changed.push(k); } };
  ["fileName", "onCommons", "commonsChecked", "subtitlePageUrl", "subtitleCreators", "timedTextAuthors", "wikidata"].forEach(take);
  for (const s of fresh.additionalSubtitles || []) {
    const mine = (t.additionalSubtitles ||= []).find((x) => x.language === s.language);
    if (mine && s.pageUrl && mine.pageUrl !== s.pageUrl) { mine.pageUrl = s.pageUrl; changed.push(`subtitles (${s.language})`); }
    if (!mine) { t.additionalSubtitles.push(s); changed.push(`subtitles (${s.language})`); }
  }
  for (const key of ["people", "interviewees"]) {
    const name = key === "people" ? "name" : "fullName";
    for (const p of t[key] || []) {
      const q = (fresh[key] || []).find((x) => x[name] === p[name])?.wikidataQid;
      if (q && q !== p.wikidataQid) { p.wikidataQid = q; changed.push(`${p[name]}: ${q}`); }
    }
  }
  for (const i of fresh.identifiers || []) {
    if (i.value && !(t.identifiers ||= []).some((x) => x.prop === i.prop)) { t.identifiers.push(i); changed.push(i.label || i.prop); }
  }
  return changed;
}

// npm run update kip002 [Tome save] [all]
async function update(id, rest) {
  const s = stored(id) || fail(`${id} isn't in the archive yet. Use npm run stage ${id}`);
  let t = readJSON(s.path);
  const from = rest.find((a) => !["all"].includes(a));
  if (from) {
    if (!existsSync(from)) fail(`not found: ${from}`);
    const fresh = readJSON(from);
    if (isoOf(fresh) && isoOf(fresh) !== s.iso) fail(`${from} is a ${isoOf(fresh)} record, not ${s.iso}`);
    if (rest.includes("all")) {
      // keep what the archive added
      for (const k of ["fileUrl", "firstPublishedUrl", "firstPublishedBy"]) if (!fresh[k] && t[k]) fresh[k] = t[k];
      for (const i of t.identifiers || []) if (!(fresh.identifiers ||= []).some((x) => x.prop === i.prop)) fresh.identifiers.push(i);
      t = fresh;
      console.log(`Replaced the whole record with ${basename(from)}.`);
    } else {
      const changed = merge(t, fresh);
      console.log(changed.length ? "Updated: " + changed.join("; ") : "Nothing new in " + basename(from));
    }
  }
  await refreshLinks(t, id);
  writeJSON(s.path, t);
  const d = draftDir(id);
  for (const f of d ? readdirSync(d.dir).filter((f) => f.startsWith(id + ".") && f.endsWith(".srt")) : []) {
    const dest = join(s.dir, f);
    if (!existsSync(dest) || readFileSync(dest, "utf8") !== readFileSync(join(d.dir, f), "utf8")) { copyFileSync(join(d.dir, f), dest); console.log(`Copied ${f}`); }
  }
  if (!check()) fail("\nFix what's listed above and run this again.");
  console.log(`\nPublish: npm run push "${id} updated"\nThen the Internet Archive item: npm run ia ${id} update go`);
}

// npm run webm kip002 -> kip002.webm for Commons (VP9 + Opus)
function webm(id) {
  const d = draftDir(id) || fail(`no folder for ${id}`);
  const src = readdirSync(d.dir).find((f) => f.startsWith(id + ".") && MEDIA.test(f) && !/\.webm$/i.test(f)) || fail(`no recording in ${d.dir}`);
  const out = join(d.dir, id + ".webm");
  if (existsSync(out)) fail(`${out} is already there`);
  if (run("ffmpeg", ["-hide_banner", "-i", join(d.dir, src), "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k", out])) console.log(`\n${out}`);
}

const [cmd, id, ...rest] = process.argv.slice(2);
const commands = { new: () => newItem(id, rest[0]), ia: () => ia(id, rest), stage: () => stage(id), update: () => update(id, rest), webm: () => webm(id) };
(commands[cmd] || (() => fail("npm run new | ia | stage | update | webm")))();
