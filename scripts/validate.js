#!/usr/bin/env node
// Checks data/ before a pull request is merged
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, ROOT } from "./config.js";
import { load, isoOf } from "./records.js";
import { STRINGS } from "./strings.js";

const LICENCES = ["cc-by-sa-4.0", "cc-by-4.0", "cc-zero", "cc-by-sa-3.0", "cc-by-3.0"];
const tome = JSON.parse(readFileSync(join(ROOT, "schema", "tome.json"), "utf8"));
const { collections, items, errors } = load(DATA_DIR);
const warnings = [];

for (const c of collections) {
  if (!c.language) errors.push(`${c.iso}/collection.json: "language" is empty`);
  if (!Array.isArray(c.map) || c.map.length !== 2) errors.push(`${c.iso}/collection.json: "map" needs [latitude, longitude]`);
  const numbers = c.sessions.flatMap((s) => s.items.map((it) => it.n)).sort((a, b) => a - b);
  numbers.forEach((n, i) => { if (n !== i + 1) errors.push(`${c.iso}: item numbers should run ${c.iso}001, ${c.iso}002 and so on with no gaps or repeats`); });
  c.sessions.forEach((s, i) => { if (s.n !== i + 1) errors.push(`${c.iso}: session folders should run r1, r2, r3 with no gaps`); });
}

for (const it of items) {
  const t = it.tome;
  const where = it.path;
  if (!t.title) errors.push(`${where}: "title" is empty`);
  if (isoOf(t) && isoOf(t) !== it.session.collection.iso) errors.push(`${where}: "languageISO" is "${isoOf(t)}" but the folder is ${it.session.collection.iso}`);
  if (!["audio", "video"].includes(t.fileType)) errors.push(`${where}: "fileType" should be "audio" or "video"`);
  if (!LICENCES.includes(t.license)) errors.push(`${where}: "license" should be one of ${LICENCES.join(", ")}`);
  if (!(t.interviewees || []).some((p) => p.fullName)) errors.push(`${where}: name at least one person in "interviewees"`);
  if (!t.fileUrl && !t.fileName && !(t.identifiers || []).length) errors.push(`${where}: add a "fileUrl", a Commons "fileName" or an identifier where it can be watched`);
  if (t._version !== tome.version) warnings.push(`${where}: Tome ${t._version}, current is ${tome.version}; run npm run tome-sync`);
  if (t.fileType === "video" && !it.subtitles.length) warnings.push(`${where}: no subtitle files yet`);
}

for (const [lang, strings] of Object.entries(STRINGS)) {
  for (const key of Object.keys(strings)) if (!(key in STRINGS.en)) errors.push(`strings/${lang}.json: "${key}" isn't in en.json`);
  for (const [key, text] of Object.entries(STRINGS.en)) {
    if (!strings[key]) continue;
    const slots = (s) => (s.match(/\{\w+\}/g) || []).sort().join(" ");
    if (slots(strings[key]) !== slots(text)) errors.push(`strings/${lang}.json: "${key}" should keep ${slots(text)}`);
  }
}

const unique = [...new Set(errors)];
if (warnings.length) console.warn(warnings.join("\n"));
if (unique.length) {
  console.error(unique.join("\n"));
  process.exit(1);
}
console.log(`${items.length} items checked.`);
