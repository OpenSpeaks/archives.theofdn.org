import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const ITEM_ID = /^([a-z]{3})(\d{3,})$/;
export const SESSION_DIR = /^r(\d+)$/;
const SUBTITLE = /^([a-z]{3}\d{3,})\.([A-Za-z0-9-]+)\.srt$/;

const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()).sort() : []);

function read(file, errors) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${file}: ${e.message}`);
  }
}

// Tome has saved some codes with quote marks round them
export const isoOf = (t) => String(t.languageISO || "").replace(/["']/g, "").trim();

// [[:w:Awadhi language|Awadhi language]] -> Awadhi language
export const plain = (s) => String(s || "").replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?/g, "");

const filePath = (name) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(name.replaceAll(" ", "_"));

export function mediaUrl(t) {
  return t.fileUrl || (t.onCommons && t.fileName ? filePath(t.fileName) : "");
}

export function posterUrl(t) {
  if (t.extra?.poster) return t.extra.poster;
  return t.fileType === "video" && t.onCommons && t.fileName ? filePath(t.fileName) + "?width=640" : "";
}

// data/<iso>/words/w<n>.json describes a list, w<n>.csv holds its words (n,word,file)
function loadWordlists(dir, col, errors) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^w\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))).map((f) => {
    const key = f.slice(0, -5);
    const meta = read(join(dir, f), errors) || {};
    const csv = join(dir, key + ".csv");
    if (!existsSync(csv)) { errors.push(`${col.iso}/words/${key}.json: add ${key}.csv with its words`); return null; }
    const words = readFileSync(csv, "utf8").split("\n").slice(1).filter(Boolean).map((line) => {
      const m = /^(\d+),"((?:[^"]|"")*)","((?:[^"]|"")*)"$/.exec(line);
      if (!m) { errors.push(`${col.iso}/words/${key}.csv: can't read the line "${line.slice(0, 60)}"`); return null; }
      return { n: Number(m[1]), word: m[2].replaceAll('""', '"'), file: m[3].replaceAll('""', '"') };
    }).filter(Boolean);
    return { ...meta, key, id: `${col.iso}-${key}`, collection: col, words };
  }).filter(Boolean);
}

// Tome's people list with roles, or the older interviewees list
export function peopleOf(t) {
  if ((t.people || []).some((p) => p.name)) return t.people.filter((p) => p.name).map((p) => ({ name: p.name, qid: p.wikidataQid || "", roles: p.roles || [] }));
  return (t.interviewees || []).filter((p) => p.fullName).map((p) => ({ name: p.fullName, qid: p.wikidataQid || "", roles: p.role ? p.role.toLowerCase().split(", ") : [] }));
}

// person name -> Wikidata id, from every record that has one
export const QIDS = new Map();

// collections > sessions > items, read from data/<iso>/collection.json and data/<iso>/r<n>/
export function load(dataDir) {
  const errors = [];
  const collections = [];
  const items = [];
  for (const iso of dirs(dataDir)) {
    const base = join(dataDir, iso);
    if (!existsSync(join(base, "collection.json"))) {
      errors.push(`${iso}/: add a collection.json`);
      continue;
    }
    const col = { ...read(join(base, "collection.json"), errors), iso, sessions: [] };
    col.extras = (col.extras || []).map((x, i) => ({ ...x, id: `${iso}-x${String(i + 1).padStart(2, "0")}` }));
    for (const dir of dirs(base).filter((d) => d !== "words")) {
      const m = SESSION_DIR.exec(dir);
      if (!m) { errors.push(`${iso}/${dir}/: session folders are named r1, r2, r3`); continue; }
      const session = { id: `${iso}-${dir}`, n: Number(m[1]), collection: col, items: [] };
      const names = readdirSync(join(base, dir)).sort();
      const subs = names.map((f) => SUBTITLE.exec(f)).filter(Boolean);
      for (const name of names.filter((f) => f.endsWith(".json"))) {
        const id = name.slice(0, -5);
        const im = ITEM_ID.exec(id);
        if (!im || im[1] !== iso) { errors.push(`${iso}/${dir}/${name}: name it ${iso} and a number, such as ${iso}001.json`); continue; }
        const path = join(base, dir, name);
        const tome = read(path, errors);
        if (!tome) continue;
        const item = { id, n: Number(im[2]), session, tome, raw: readFileSync(path, "utf8"), path: `${iso}/${dir}/${name}` };
        item.subtitles = subs.filter((s) => s[1] === id).map((s) => ({ language: s[2], file: s[0], text: readFileSync(join(base, dir, s[0]), "utf8") }));
        session.items.push(item);
        for (const p of peopleOf(tome)) if (p.qid && !QIDS.has(p.name)) QIDS.set(p.name, p.qid);
        items.push(item);
      }
      for (const s of subs) if (!session.items.some((it) => it.id === s[1])) errors.push(`${iso}/${dir}/${s[0]}: there's no ${s[1]}.json for this subtitle`);
      if (!session.items.length) continue;
      session.items.sort((a, b) => a.n - b.n);
      const roles = new Map();
      for (const it of session.items) {
        for (const p of peopleOf(it.tome)) {
          if (!roles.has(p.name)) roles.set(p.name, new Set());
          for (const r of p.roles) roles.get(p.name).add(r);
        }
      }
      session.people = [...roles].map(([name, set]) => ({ name, roles: [...set] }));
      const speaking = session.people.filter((p) => p.roles.some((r) => /speaker|interviewee|participant/i.test(r)) || !p.roles.length);
      session.speakers = (speaking.length ? speaking : session.people.slice(0, 1)).map((p) => p.name);
      // every value the items hold, in item order
      const all = (f) => [...new Set(session.items.map((it) => f(it.tome)).filter(Boolean))];
      session.variety = all((t) => t.dialect).join(", ");
      session.project = all((t) => t.projectName).join(", ");
      session.places = all((t) => t.recordingPlace);
      session.place = session.places.join("; ") || col.place;
      session.dates = all((t) => t.date || t.year).sort();
      session.date = session.dates.length > 1 ? `${session.dates[0]} to ${session.dates[session.dates.length - 1]}` : session.dates[0] || "";
      session.recordists = all((t) => t.recordist);
      session.recordist = session.recordists.join(", ");
      session.portrait = session.items.map((it) => it.tome.extra?.portrait).find(Boolean);
      col.sessions.push(session);
    }
    col.sessions.sort((a, b) => a.n - b.n);
    col.wordlists = loadWordlists(join(base, "words"), col, errors);
    collections.push(col);
  }
  return { collections, items, errors };
}
