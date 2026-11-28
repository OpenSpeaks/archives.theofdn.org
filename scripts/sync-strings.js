// Keeps strings/data/<code>.json in step with en.json for Localise.
// New keys come in empty, unused keys go, translations stay.
// "@outdated" holds the English a translation was made from when that English has since changed.
// "@wikidata" lists names filled from Wikidata labels and not yet checked by a person.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const UA = "OpenSpeaksArchivesBuild/0.1 (https://theofdn.org/openspeaks/)";
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {});

async function labels(ids, lang) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=${lang}&ids=${ids.slice(i, i + 50).join("|")}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      for (const [id, e] of Object.entries((await res.json()).entities || {})) if (e.labels?.[lang]) out[id] = e.labels[lang].value;
    } catch (e) {
      console.warn(`Wikidata labels in ${lang}: ${e.message}`);
      return out;
    }
  }
  return out;
}

export async function syncStrings(dir, oldEn, en) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
    const lang = file.slice(0, -5);
    const was = read(join(dir, file));
    const outdated = { ...was["@outdated"] };
    const fromWikidata = new Set(was["@wikidata"] || []);
    const out = {};
    for (const [key, text] of Object.entries(en)) {
      out[key] = was[key] || "";
      if (out[key] && key in oldEn && oldEn[key] !== text && !(key in outdated)) outdated[key] = oldEn[key];
    }
    // names with a Wikidata id and no translation yet
    const empty = Object.keys(out).filter((k) => !out[k] && /^(person|language)\.Q\d+$/.test(k));
    const found = empty.length ? await labels(empty.map((k) => k.split(".")[1]), lang) : {};
    for (const k of empty) if (found[k.split(".")[1]]) { out[k] = found[k.split(".")[1]]; fromWikidata.add(k); }
    const head = {};
    const keep = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k in en && out[k]));
    if (Object.keys(keep(outdated)).length) head["@outdated"] = keep(outdated);
    const checked = [...fromWikidata].filter((k) => k in en && out[k]).sort();
    if (checked.length) head["@wikidata"] = checked;
    const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(join(dir, file), JSON.stringify({ ...head, ...sorted }, null, 2) + "\n");
  }
}
