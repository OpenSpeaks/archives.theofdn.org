#!/usr/bin/env node
// Keeps records in step with Tome. Reads Tome's source (a local checkout or
// the GitLab copy), saves its version and field list to schema/tome.json,
// and lists records that are older or use fields Tome has dropped.
//   npm run tome-sync                 report only
//   npm run tome-sync -- --write      rename fields listed in schema/renames.json and bump _version
//   TOME_SRC=~/tome/src/main.jsx npm run tome-sync
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, DATA_DIR } from "./config.js";
import { load } from "./records.js";

const REMOTE = "https://gitlab.wikimedia.org/toolforge-repos/tome/-/raw/main/src/main.jsx";
const write = process.argv.includes("--write");

const src = process.env.TOME_SRC ? readFileSync(process.env.TOME_SRC, "utf8") : await (await fetch(REMOTE)).text();
const code = src.replace(/(^|\s)\/\/[^\n]*/g, "$1");
const version = /const SCHEMA_VERSION = "([^"]+)"/.exec(code)?.[1];
const body = /const defaultRecord = \{([\s\S]*?)\n\};/.exec(code)?.[1];
// fields Tome fills in when it opens a saved file
const loaded = /return \{\s*\.\.\.defaultRecord,([\s\S]*?)\n {2}\};/.exec(code)?.[1] ?? "";
if (!version || !body) {
  console.error("Couldn't find SCHEMA_VERSION or defaultRecord in Tome's source.");
  process.exit(1);
}

// top-level keys only: drop nested braces and brackets first
function keys(text) {
  let flat = text;
  while (/\{[^{}]*\}|\[[^[\]]*\]|\([^()]*\)/.test(flat)) flat = flat.replace(/\{[^{}]*\}|\[[^[\]]*\]|\([^()]*\)/g, "0");
  return [...flat.matchAll(/(?:^|,)\s*(_?[A-Za-z]\w*)\s*:/g)].map((m) => m[1]);
}
const fields = [...new Set([...keys(body), ...keys(loaded)])];

const schemaFile = join(ROOT, "schema", "tome.json");
const before = existsSync(schemaFile) ? JSON.parse(readFileSync(schemaFile, "utf8")) : { version: "", fields: [] };
writeFileSync(schemaFile, JSON.stringify({ version, source: REMOTE, fields }, null, 2) + "\n");

const added = fields.filter((f) => !before.fields.includes(f));
const removed = before.fields.filter((f) => !fields.includes(f));
console.log(`Tome schema ${before.version || "(none saved)"} -> ${version}`);
if (added.length) console.log(`New in Tome: ${added.join(", ")}`);
if (removed.length) console.log(`Gone from Tome: ${removed.join(", ")}`);

const renamesFile = join(ROOT, "schema", "renames.json");
const renames = existsSync(renamesFile) ? JSON.parse(readFileSync(renamesFile, "utf8")) : {};

const { items } = load(DATA_DIR);
let old = 0;
for (const item of items) {
  const t = item.tome;
  const unknown = Object.keys(t).filter((k) => !fields.includes(k) && !(k in renames));
  if (t._version !== version) old++;
  if (unknown.length) console.log(`${item.path}: fields Tome doesn't have: ${unknown.join(", ")}`);
  if (write && (t._version !== version || Object.keys(renames).some((k) => k in t))) {
    const next = {};
    for (const [k, v] of Object.entries(t)) next[renames[k] || k] = v;
    next._version = version;
    writeFileSync(join(DATA_DIR, item.path), JSON.stringify(next, null, 2) + "\n");
  }
}
console.log(`${old} of ${items.length} records are on an older Tome version${write ? "; updated" : ""}.`);
