import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, BASE } from "./config.js";

// strings/<code>.json, English first; an empty string falls back to English
const DIR = join(ROOT, "strings");
export const LANGS = ["en", ...readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "en.json").map((f) => f.slice(0, -5)).sort()];
export const STRINGS = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(join(DIR, l + ".json"), "utf8"))]));
// names and record text, strings/data/<code>.json
const dataFile = (l) => join(DIR, "data", l + ".json");
export const DATA = Object.fromEntries(LANGS.map((l) => [l, existsSync(dataFile(l)) ? JSON.parse(readFileSync(dataFile(l), "utf8")) : {}]));

let lang = "en";
export const setLang = (l) => { lang = l; };
export const getLang = () => lang;

// English pages at the root, others under /<code>/
export const prefix = (l = lang) => (l === "en" ? "" : l + "/");
export const page = (path, l = lang) => BASE + prefix(l) + path.replace(/^\//, "");

export function lookup(key) {
  const s = STRINGS[lang][key] || STRINGS.en[key];
  if (s === undefined) throw new Error(`strings/en.json has no "${key}"`);
  return s;
}

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const raw = (key, vars = {}) => fill(lookup(key), vars);
// template is escaped, vars go in as given
export const t = (key, vars = {}) => fill(esc(lookup(key)), vars);

// names of strings site.js uses
export const CLIENT = ["subtitles", "subtitlesOff", "linkCopied", "copied", "play", "playWord", "copyLink", "wordsShown", "wordsNone", "wordsFailed"];
