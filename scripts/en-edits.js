// Titles and descriptions corrected by hand in strings/data/en.json go back into the records,
// so the build doesn't overwrite them. Compared with the last commit to tell a hand edit from a record edit.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const recordPath = (dataDir, id) => {
  const w = id.match(/^([a-z]{3})-(w\d+)$/);
  if (w) return join(dataDir, w[1], "words", w[2] + ".json");
  const iso = id.slice(0, 3);
  const base = join(dataDir, iso);
  if (!existsSync(base)) return null;
  for (const dir of readdirSync(base).filter((d) => /^r\d+$/.test(d))) {
    const f = join(base, dir, id + ".json");
    if (existsSync(f)) return f;
  }
  return null;
};

// swap one field's value in place so the rest of the file keeps its layout
function setField(file, field, value) {
  const s = readFileSync(file, "utf8");
  const old = JSON.parse(s)[field];
  const from = `"${field}": ${JSON.stringify(old)}`;
  const i = old === undefined ? -1 : s.indexOf(from);
  if (i < 0) {
    const t = JSON.parse(s);
    t[field] = value;
    writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
  } else {
    writeFileSync(file, s.slice(0, i) + `"${field}": ${JSON.stringify(value)}` + s.slice(i + from.length));
  }
}

// returns the en.json of the last commit, to compare the new English against
export function applyEnEdits(root, dataDir) {
  const enFile = join(root, "strings", "data", "en.json");
  const disk = JSON.parse(readFileSync(enFile, "utf8"));
  let head;
  try {
    head = JSON.parse(execSync("git show HEAD:strings/data/en.json", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return disk;
  }
  const descFile = join(root, "..", "build", "descriptions.json");
  const descriptions = existsSync(descFile) ? JSON.parse(readFileSync(descFile, "utf8")) : null;
  let changed = false;
  for (const [key, text] of Object.entries(disk)) {
    if (!(key in head) || head[key] === text) continue;
    const m = key.match(/^(.+)\.(title|description)$/);
    const file = m && recordPath(dataDir, m[1]);
    if (!file) {
      console.warn(`en.json: ${key} was edited by hand, but names come from the records. Change it there.`);
      continue;
    }
    setField(file, m[2], text);
    if (descriptions && m[2] === "description" && m[1] in descriptions) { descriptions[m[1]] = text; changed = true; }
    console.log(`en.json: ${key} written to ${file.slice(dataDir.length + 1)}`);
  }
  if (changed) writeFileSync(descFile, JSON.stringify(descriptions, null, 1));
  return head;
}
