import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./config.js";

// parser from psubhashish.com's main.js, moved to the build

function readBraced(src, start) {
  let depth = 0, i = start, out = "";
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{" && ++depth === 1) continue;
    if (ch === "}" && --depth === 0) { i++; break; }
    out += ch;
  }
  return [out, i];
}

function clean(s) {
  return s
    .replace(/\\(?:textit|textbf|emph|url)\{([^}]*)\}/g, "$1")
    .replace(/\{([^}]*)\}/g, "$1")
    .replace(/\\&/g, "&")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fields(body) {
  const out = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    const eq = body.indexOf("=", i);
    if (eq < 0) break;
    const name = body.slice(i, eq).trim().toLowerCase();
    i = eq + 1;
    while (/\s/.test(body[i])) i++;
    let value;
    if (body[i] === "{") [value, i] = readBraced(body, i);
    else if (body[i] === '"') { const end = body.indexOf('"', i + 1); value = body.slice(i + 1, end); i = end + 1; }
    else { const end = body.indexOf(",", i); value = body.slice(i, end < 0 ? body.length : end).trim(); i = end < 0 ? body.length : end; }
    if (name) out[name] = name === "author" || name === "editor" ? value : clean(value);
  }
  return out;
}

export function parseBibtex(src) {
  const entries = [];
  const head = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = head.exec(src))) {
    let depth = 1, pos = head.lastIndex;
    while (pos < src.length && depth) { if (src[pos] === "{") depth++; else if (src[pos] === "}") depth--; pos++; }
    const type = m[1].toLowerCase();
    if (!["comment", "string", "preamble"].includes(type)) entries.push({ type, key: m[2], ...fields(src.slice(head.lastIndex, pos - 1)) });
    head.lastIndex = pos;
  }
  return entries;
}

// "Gomango, Opino and {Global Voices}" -> ["Opino Gomango", "Global Voices"]
export const people = (s) => (s ? s.split(/\s+and\s+/).map((a) => {
  if (/^\{.*\}$/.test(a.trim())) return clean(a);
  const [last, first] = clean(a).split(/,\s*/);
  return first ? `${first} ${last}` : last;
}) : []);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// biblatex date, or year with optional month and day, as YYYY[-MM[-DD]]
export function dateOf(e) {
  if (e.date) return e.date;
  const m = e.month && (Number(e.month) || MONTHS.indexOf(e.month.slice(0, 3).toLowerCase()) + 1);
  return [e.year, m && String(m).padStart(2, "0"), m && e.day && String(e.day).padStart(2, "0")].filter(Boolean).join("-");
}

export function loadBib(name) {
  const file = join(ROOT, "publications", name + ".bib");
  if (!existsSync(file)) return [];
  return parseBibtex(readFileSync(file, "utf8")).map((e) => {
    if (!e.title || !/^\d{4}/.test(dateOf(e))) throw new Error(`publications/${name}.bib: ${e.key} needs a title and a date or year`);
    return e;
  });
}
