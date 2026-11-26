// Dublin Core (oai_dc) for one item, from its Tome record
import { arkUrl, SITE_NAME } from "./config.js";
import { isoOf, plain } from "./records.js";

const x = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

const MIME = { WebM: "video/webm", MP4: "video/mp4", WAV: "audio/wav", MP3: "audio/mpeg", OGG: "audio/ogg" };

const LICENCES = {
  "cc-by-sa-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "cc-by-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "cc-zero": "https://creativecommons.org/publicdomain/zero/1.0/",
};

export function dcFields(item) {
  const t = item.tome;
  const out = [];
  const add = (name, value) => value && out.push([name, value]);
  add("title", plain(t.title));
  for (const e of t.extraTitles || []) add("title", e.text);
  add("creator", t.recordist);
  for (const p of item.session.people) add("contributor", p.name);
  for (const k of String(t.topic || "").split(",")) add("subject", k.trim());
  for (const k of t.keywords || []) add("subject", k);
  add("description", plain(t.description));
  for (const e of t.extraDescriptions || []) add("description", plain(e.text));
  add("publisher", SITE_NAME);
  add("date", t.date || t.year);
  add("type", t.fileType === "audio" ? "Sound" : "MovingImage");
  add("format", t.mimeType || MIME[t.format] || (t.fileName?.endsWith(".webm") ? "video/webm" : t.format));
  add("identifier", arkUrl(item.id));
  for (const i of t.identifiers || []) add("identifier", i.prop === "P1184" ? `https://hdl.handle.net/${i.value}` : i.value);
  add("language", isoOf(t));
  for (const s of item.subtitles) add("relation", arkUrl(`${item.id}/${s.language}/srt`));
  add("coverage", t.recordingPlace);
  add("relation", arkUrl(item.session.id));
  add("rights", LICENCES[t.license] || t.license);
  return out;
}

export function dublinCore(item) {
  const rows = dcFields(item).map(([k, v]) => `  <dc:${k}>${x(v)}</dc:${k}>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
${rows}
</oai_dc:dc>
`;
}
