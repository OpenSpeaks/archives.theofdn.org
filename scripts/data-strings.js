import { plain, peopleOf } from "./records.js";

// Names and record text a translator can work on, written to strings/data/en.json.
// Keys holding a Wikidata id (person.Q123, language.Q456) can be filled from Wikidata labels.
export const personKey = (p) => "person." + (p.qid || p.name);
export const languageKey = (c) => "language." + (c.wikidata || c.iso);

export function dataStrings(collections) {
  const out = {};
  const put = (key, value) => { if (value && !(key in out)) out[key] = String(value); };
  for (const c of collections) {
    put(languageKey(c), c.language);
    put(`place.${c.place}`, c.place);
    for (const w of c.wordlists) {
      put(`${w.id}.title`, w.title);
      put(`${w.id}.description`, w.description);
      put(`person.${w.speaker}`, w.speaker);
    }
    for (const s of c.sessions) {
      for (const it of s.items) {
        const t = it.tome;
        put(`${it.id}.title`, plain(t.title));
        put(`${it.id}.description`, plain(t.description));
        for (const p of peopleOf(t)) put(personKey(p), p.name);
        put(`place.${t.recordingPlace}`, t.recordingPlace);
        put(`variety.${t.dialect}`, t.dialect);
        put(`project.${t.projectName}`, t.projectName);
      }
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
