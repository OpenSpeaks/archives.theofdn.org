#!/usr/bin/env node
// Authority records in authority/: people (p) and languages, varieties and registers (v)
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ARK_NAAN, ARK_SHOULDER } from "./config.js";
import { peopleOf, QIDS } from "./records.js";

const DIR = join(ROOT, "authority");
const NOID = "0123456789bcdfghjkmnpqrstvwxz";
export const AUTHORITY_ID = /^[pv]\d{5}[0-9bcdfghjkmnpqrstvwxz]$/;

// NOID check character over NAAN/blade, hyphens left out since ARKs ignore them
export function check(blade) {
  const s = `${ARK_NAAN}/${(ARK_SHOULDER + blade).replaceAll("-", "")}`;
  return NOID[[...s].reduce((n, c, i) => n + Math.max(NOID.indexOf(c), 0) * (i + 1), 0) % 29];
}

export function loadAuthorities() {
  const people = [];
  const languages = [];
  const errors = [];
  if (!existsSync(DIR)) return { people, languages, errors };
  for (const f of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
    const id = f.slice(0, -5);
    if (!AUTHORITY_ID.test(id) || check(id.slice(0, -1)) !== id.slice(-1)) { errors.push(`authority/${f}: not a valid id`); continue; }
    const a = { ...JSON.parse(readFileSync(join(DIR, f), "utf8")), id };
    if (!a.name) errors.push(`authority/${f}: "name" is empty`);
    (id[0] === "p" ? people : languages).push(a);
  }
  for (const v of languages) if (v.parent && !languages.some((x) => x.id === v.parent)) errors.push(`authority/${v.id}.json: parent ${v.parent} doesn't exist`);
  return { people, languages, errors };
}

const UA = { "User-Agent": "OpenSpeaksArchivesBuild/0.1 (https://theofdn.org/openspeaks/)" };
const entities = async (ids) => (await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions|aliases|claims&languages=en&ids=${ids.join("|")}`, { headers: UA })).json()).entities;
// year, month or day, as precise as Wikidata has it
const when = (v) => v && v.time.slice(1, { 9: 5, 10: 8, 11: 11 }[v.precision] || 5).replace(/-$/, "");

// the details we put on the person's Wikidata item
async function fromWikidata(qid) {
  const e = (await entities([qid]))[qid];
  const claim = (p) => (e.claims[p] || []).map((c) => c.mainsnak.datavalue?.value).filter(Boolean);
  const refs = [...new Set([...claim("P1412"), ...claim("P106")].map((v) => v.id))];
  const labels = refs.length ? await entities(refs) : {};
  const named = (p) => claim(p).map((v) => ({ wikidata: v.id, name: labels[v.id]?.labels?.en?.value || v.id }));
  return {
    name: e.labels.en?.value || "",
    otherNames: (e.aliases.en || []).map((a) => a.value),
    description: e.descriptions.en?.value || "",
    born: when(claim("P569")[0]) || "",
    died: when(claim("P570")[0]) || "",
    languagesSpoken: named("P1412"),
    occupations: named("P106"),
    image: claim("P18")[0] || "",
    ...(claim("P18")[0] && (await imageCredit(claim("P18")[0]))),
  };
}

// who took the photo, and its licence, as Commons gives them
async function imageCredit(file) {
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=File:${encodeURIComponent(file)}`, { headers: UA });
  const m = Object.values((await r.json()).query.pages)[0].imageinfo?.[0]?.extmetadata || {};
  return { imageBy: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim(), imageLicence: m.LicenseShortName?.value || "" };
}

// npm run mint p Q123   or   npm run mint v Q123
async function mint(type, qid) {
  if (!["p", "v"].includes(type)) throw new Error("npm run mint p|v [Wikidata id]");
  const { people, languages } = loadAuthorities();
  const taken = (type === "p" ? people : languages).map((a) => Number(a.id.slice(1, 6)));
  if (qid && [...people, ...languages].some((a) => a.wikidata === qid)) throw new Error(`${qid} already has a record`);
  const blade = type + String(Math.max(0, ...taken) + 1).padStart(5, "0");
  const id = blade + check(blade);
  const wd = qid ? await fromWikidata(qid) : { name: "", otherNames: [] };
  const record = type === "p"
    ? { ...wd, wikidata: qid || "" }
    : { name: wd.name, otherNames: wd.otherNames, level: "", parent: "", iso: "", glottolog: "", wikidata: qid || "" };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, id + ".json"), JSON.stringify(record, null, 2) + "\n");
  console.log(`authority/${id}.json  ${record.name}`);
}

// which person and which language or variety each item points to
export function linkRecords(collections, { people, languages }) {
  const byKey = new Map();
  for (const p of people) for (const k of [p.wikidata, p.name, ...(p.otherNames || [])].filter(Boolean)) byKey.set(k, p);
  const personOf = (name, qid) => byKey.get(qid || QIDS.get(name)) || byKey.get(name);
  for (const a of [...people, ...languages]) {
    a.items = [];
    a.wordlists = [];
  }
  for (const c of collections) {
    const lang = languages.find((v) => v.level === "language" && v.iso === c.iso);
    const lectOf = (d) => (d && languages.find((v) => v.parent && v.parent === lang?.id && [v.name, ...(v.otherNames || [])].some((n) => n === d || n === `${d} ${c.language}`))) || lang;
    c.lect = lang;
    for (const s of c.sessions) for (const it of s.items) {
      it.lect = lectOf(it.tome.dialect);
      it.lect?.items.push(it);
      for (const x of peopleOf(it.tome)) personOf(x.name, x.qid)?.items.push({ it, roles: x.roles });
    }
    for (const w of c.wordlists) {
      w.lect = lectOf(w.dialect);
      w.lect?.wordlists.push(w);
      personOf(w.speaker)?.wordlists.push(w);
    }
  }
  return personOf;
}

if (process.argv[2] === "mint") await mint(process.argv[3], process.argv[4]);
