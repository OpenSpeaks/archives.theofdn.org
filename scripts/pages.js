import { BASE, SITE_NAME, HOST, arkName, arkUrl } from "./config.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isoOf, plain, mediaUrl, posterUrl } from "./records.js";
import { ROOT } from "./config.js";

const LOGO = readFileSync(join(ROOT, "assets", "logo.svg"), "utf8").trim();

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const u = (path) => BASE + path.replace(/^\//, "");

const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
const scriptNames = new Intl.DisplayNames(["en"], { type: "script", fallback: "none" });

// en -> English, gju-deva -> Gujari (Devanagari), using the collection's own name for its code
export function trackLabel(code, col) {
  const [base, script] = code.split("-");
  let name = base;
  try { name = base === col.iso ? col.language : languageNames.of(base) || base; } catch {}
  const s = script?.length === 4 && scriptNames.of(script[0].toUpperCase() + script.slice(1));
  return s ? `${name} (${s})` : name;
}

export function names(list) {
  if (list.length < 2) return list.join("");
  return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

function mins(s) {
  const n = Math.round(Number(s));
  if (!n) return "";
  return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
}

const LICENCE = { "cc-by-sa-4.0": "CC BY-SA 4.0", "cc-by-4.0": "CC BY 4.0", "cc-zero": "CC0" };
const COPY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1h9v11H5zM2 4v11h9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

// the short id on show, the full link on the clipboard
export function pid(id) {
  return `<button type="button" class="pid" data-url="${arkUrl(id)}" aria-label="Copy the link to ${esc(arkName(id))}"><code>${esc(arkName(id))}</code>${COPY_ICON}<span class="pid-done" aria-live="polite"></span></button>`;
}

function fields(rows) {
  return `<dl class="fields">${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}

function citeBox(text) {
  return `<div class="cite"><span>Cite</span><p>${esc(text)}</p><button type="button" class="copy" data-cite="${esc(text)}">Copy</button></div>`;
}

function deposits(item) {
  const t = item.tome;
  const out = [];
  for (const i of t.identifiers || []) {
    if (i.prop === "P1184") out.push(`<a href="https://hdl.handle.net/${esc(i.value)}">Language Archive Cologne</a>`);
  }
  if (t.onCommons && t.fileName) out.push(`<a href="https://commons.wikimedia.org/wiki/File:${esc(encodeURIComponent(t.fileName.replaceAll(" ", "_")))}">Wikimedia Commons</a>`);
  return out.join("<br>");
}

function ticks(collections, active) {
  return collections.map((c) => `<a href="${u(c.iso + "/")}" class="${c.iso === active ? "on" : ""}" title="${esc(c.language)}" aria-label="${esc(c.language)}"${c.iso === active ? ' aria-current="page"' : ""}></a>`).join("");
}

function subtitleCredits(s) {
  const names = new Set();
  for (const it of s.items) for (const x of it.subtitles) for (const p of subtitlers(it.tome, x.language).split(", ")) if (p) names.add(p.replace(/ \(editor\)/, ""));
  return [...names];
}

function credits(people, recordists, photos, subtitlersList = []) {
  const seen = new Set();
  const pics = photos.filter((p) => p && !seen.has(p.src) && seen.add(p.src));
  return `<section class="credits-page"><h2>Credits</h2>
<p>Speakers and interviewers: ${esc(names(people))}.</p>
${recordists.length ? `<p>Recorded by ${esc(names(recordists))}.</p>` : ""}
${subtitlersList.length ? `<p>Subtitles by ${esc(names(subtitlersList))}.</p>` : ""}
${pics.length ? `<p>Photographs: ${pics.map((p) => `${esc(p.of)} by ${esc(p.by)}`).join("; ")}.</p>` : ""}
</section>`;
}

export function shell({ title, body, collections, active = "", head = "", script = "" }) {
  const at = collections.findIndex((c) => c.iso === active);
  const pad = (n) => String(n).padStart(3, "0");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Recordings made with speakers of Indigenous and endangered languages in South Asia.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&family=Inter+Tight:wght@600..900&display=swap">
<link rel="stylesheet" href="${u("style.css")}">
${head}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="paper">
  <div class="wrap bar">
    <a class="mark" href="${u("")}">${LOGO}</a>
    <span class="arrow" aria-hidden="true">&rarr;</span>
    <nav aria-label="Main">
      <a href="${u("")}#languages">Languages</a>
      <a href="${u("data/")}">Data</a>
      <a href="${u("about/")}">About</a>
    </nav>
  </div>
  <div class="wrap"><nav class="ticks" aria-label="Languages">${ticks(collections, active)}</nav></div>
</header>
<main id="main">
${body}
</main>
<footer class="paper">
  <div class="wrap"><div class="ticks" aria-hidden="true">${collections.map((c) => `<span class="${c.iso === active ? "on" : ""}"></span>`).join("")}</div></div>
  <div class="wrap bar">
    <a href="${u("about/")}">How the archive is kept &rarr;</a>
    <svg class="logo" viewBox="-4 -1 96 96" role="img" aria-label="OpenSpeaks"><path d="M46.92,3.92C23.22,4.05,3.79,23.35,3.79,47.18c0,9.71,3.25,19.13,9.28,26.79L-.39,86.14c-1.69,1.52-.6,4.31,1.66,4.31h45.65c23.84,0,43.13-19.26,43.26-43.13,0-11.47-4.41-22.34-12.66-30.6-8.09-8.22-19-12.66-30.6-12.79ZM46.92,83.81h-.13l-34.74-.13,10.31-9.28-2.22-2.49c-6.17-6.76-9.71-15.61-9.71-24.86,0-20.02,16.48-36.33,36.5-36.33,9.85,0,19,3.81,25.89,10.74,6.93,6.93,10.74,16.18,10.61,25.89.12,20.15-16.36,36.46-36.51,36.46Z"/><circle cx="34.12" cy="48.15" r="3.51"/><circle cx="45.63" cy="48.15" r="3.51"/><circle cx="57.13" cy="48.15" r="3.51"/></svg>
    <span class="count">${pad(at + 1)}/${pad(collections.length)}</span>
  </div>
  <div class="wrap credits"><p>Recordings are published here first by ${SITE_NAME} and deposited with partner archives. The website is hosted by ${HOST}.</p></div>
</footer>
${script}<script src="${u("site.js")}"></script>
</body>
</html>
`;
}

const count = (c) => c.sessions.reduce((m, s) => m + s.items.length, 0);

export function home(collections, places) {
  const sessions = collections.reduce((n, c) => n + c.sessions.length, 0);
  const items = collections.reduce((n, c) => n + count(c), 0);
  const words = collections.reduce((n, c) => n + c.wordlists.reduce((m, w) => m + w.words.length, 0), 0);
  const body = `<section class="wrap intro">
<h1 class="display">voices in ${collections.length} languages, from the people who speak them.</h1>
<p class="lede">${sessions} recording sessions with ${items} videos and sound files, and ${words.toLocaleString("en-IN")} recorded words, made with speakers in India, Nepal and Sri Lanka. Choose a language on the map or from the list.</p>
</section>
<section class="map-band" aria-label="Map of the languages"><div id="atlas"></div></section>
<section class="wrap index" id="languages"><h2>Languages</h2><ul class="langs">
${collections.map((c) => `<li><a href="${u(c.iso + "/")}"><span class="code">${c.iso.toUpperCase()}</span><span><span class="lname">${esc(c.language)}</span><span class="lplace">${esc(c.place)}</span></span><span class="num">${c.sessions.length} rec. / ${count(c)}</span></a></li>`).join("\n")}
</ul></section>`;
  return shell({
    title: SITE_NAME, body, collections,
    head: `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">\n`,
    script: `<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>\n<script>var places = ${JSON.stringify(places)};</script>\n`,
  });
}

function sessionRow(s) {
  return `<li><a href="${u(s.id + "/")}">${s.portrait ? `<img src="${esc(s.portrait.src)}" alt="">` : '<span class="noimg"></span>'}<span><span class="lname">${esc(names(s.people.map((p) => p.name)))}</span><span class="lplace">${s.items.map((it) => esc(plain(it.tome.title))).join(", ")}</span></span><span class="num">${s.items.length} ${s.items.length === 1 ? "item" : "items"}</span></a></li>`;
}

export function collectionPage(c, collections) {
  const groups = new Map();
  for (const s of c.sessions) {
    if (!groups.has(s.variety)) groups.set(s.variety, []);
    groups.get(s.variety).push(s);
  }
  const projects = [...new Set(c.sessions.map((s) => s.project).filter(Boolean))];
  const varieties = [...groups.keys()].filter(Boolean);
  const people = [...new Set(c.sessions.flatMap((s) => s.people.map((p) => p.name)))];
  const recordists = [...new Set(c.sessions.map((s) => s.recordist).filter(Boolean))];
  const photos = [c.cover && { ...c.cover, of: "Cover" }, ...c.sessions.map((s) => s.portrait && { ...s.portrait, of: s.people[0]?.name })];
  const extras = c.extras.length ? `<h2 class="sub">Other files in this collection</h2>
<ul class="filelist">${c.extras.map((x) => `<li id="${x.id.split("-")[1]}"><span class="fname">${esc(x.title)}</span><span class="fmeta">${esc(x.fileName)}</span>${pid(x.id)}<a class="get" href="${esc(x.url)}">Open</a></li>`).join("")}</ul>` : "";
  const body = `<div class="wrap collection">
<p class="crumbs"><a href="${u("")}#languages">Languages</a> / ${esc(c.language)}</p>
<div class="chead"><div><h1 class="display">${esc(c.language)}</h1><p class="project">${esc(projects.join(", "))}</p>${pid(c.iso)}</div>${c.cover ? `<img src="${esc(c.cover.src)}" alt="">` : ""}</div>
<div class="two">
${fields([
  ["Language", `${esc(c.language)} (${c.iso})`],
  ["Varieties", esc(varieties.join(", "))],
  ["Projects", esc(projects.join(", "))],
  ["Place", esc(c.place)],
  ["Sessions", String(c.sessions.length)],
  ["Items", String(count(c))],
  ["Deposited at", (c.deposits || []).map((d) => `<a href="${esc(d.url)}">${esc(d.label)}</a>`).join("<br>")],
])}
${citeBox(`${c.language} [${c.iso}]. ${SITE_NAME}. ${arkUrl(c.iso)}`)}
</div>
${[...groups].map(([variety, list]) => `<h2 class="sub">${variety ? esc(variety) : "Recording sessions"}</h2>\n<ol class="recs">${list.map(sessionRow).join("")}</ol>`).join("\n")}
${c.wordlists.length ? `<h2 class="sub">Word lists</h2>\n<ol class="recs">${c.wordlists.map((w) => `<li><a href="${u(w.id + "/")}"><span class="noimg"></span><span><span class="lname">${esc(w.title)}</span><span class="lplace">${esc(w.speaker)}${w.dialect ? `, ${esc(w.dialect)}` : ""}</span></span><span class="num">${w.words.length.toLocaleString("en-IN")} words</span></a></li>`).join("")}</ol>` : ""}
${extras}
${credits([...people, ...c.wordlists.map((w) => w.speaker)].filter((p, i, a) => a.indexOf(p) === i), recordists, photos)}
</div>`;
  return shell({ title: `${c.language} – ${SITE_NAME}`, body, collections, active: c.iso });
}

function player(it) {
  const t = it.tome;
  const c = it.session.collection;
  const src = mediaUrl(t);
  const tracks = it.subtitles.map((s) => ({ src: u(`${it.session.id}/${it.id}.${s.language}.vtt`), lang: s.language.split("-")[0], label: trackLabel(s.language, c) }));
  if (!src) {
    const handle = (t.identifiers || []).find((i) => i.prop === "P1184");
    const poster = posterUrl(t);
    return `<div class="frame">${poster ? `<img src="${esc(poster)}" alt="" loading="lazy">` : ""}<a class="away" href="https://hdl.handle.net/${esc(handle?.value)}">Watch at Language Archive Cologne &rarr;</a></div>`;
  }
  if (t.fileType === "audio") return `<div class="sound"><audio controls preload="none" src="${esc(src)}"></audio></div>`;
  return `<div class="frame"><img src="${esc(posterUrl(t))}" alt="" loading="lazy"><button type="button" class="play" data-src="${esc(src)}" data-tracks="${esc(JSON.stringify(tracks))}">Play${mins(t.duration) ? " " + mins(t.duration) : ""}</button></div>
<button type="button" class="full" hidden>Full screen</button>`;
}

// who made a subtitle track, from the Tome record
function subtitlers(t, language) {
  const tracks = [{ language: t.subtitleLanguage, creators: t.subtitleCreators }, ...(t.additionalSubtitles || [])];
  const users = new Set(Object.values(t.timedTextAuthors || {}));
  const creators = tracks.find((x) => x.language === language)?.creators || "";
  return creators.split(",").map((p) => p.trim()).filter(Boolean)
    .map((p) => p.replace(/ \(subtitler\)$/, "")).map((p) => (users.has(p.replace(/ \(editor\)$/, "")) ? `${p} (Wikimedia Commons user)` : p)).join(", ");
}

function itemSection(it) {
  const t = it.tome;
  const s = it.session;
  const c = s.collection;
  const title = plain(t.title);
  const year = (String(t.date || t.year).match(/\d{4}/) || [""])[0];
  const cite = `${names(s.people.map((p) => p.name))}${year ? ` (${year})` : ""}. ${title}. ${c.language} [${c.iso}]. ${SITE_NAME}. ${arkUrl(it.id)}`;
  const ext = (t.fileName?.split(".").pop() || t.format || "").toLowerCase();
  const files = [
    ...(mediaUrl(t) ? [{ name: `${it.id}.${ext}`, what: t.fileType === "audio" ? "Sound" : "Video", href: mediaUrl(t) }] : []),
    ...it.subtitles.map((x) => ({ name: `${it.id}.${x.language}.srt`, what: `Subtitles, ${trackLabel(x.language, c)}${subtitlers(t, x.language) ? `, by ${subtitlers(t, x.language)}` : ""}`, href: u(`${s.id}/${it.id}.${x.language}.srt`) })),
  ];
  return `<article class="item" id="${it.id}"><div class="item-play">${player(it)}</div>
<div class="item-meta"><h3>${esc(title)}</h3>
${pid(it.id)}
${fields([
  ["Other titles", (t.extraTitles || []).map((e) => esc(e.text)).join("<br>")],
  ["Language", `${esc(t.language)} (${esc(isoOf(t))})`],
  ["Variety", esc([t.dialect, t.dialectNames && `also called ${t.dialectNames}`].filter(Boolean).join(", "))],
  ["People", esc(names((t.interviewees || []).map((p) => p.fullName)))],
  ["Place", esc(t.recordingPlace)],
  ["Recorded", esc(t.date || t.year)],
  ["Recorded by", esc(t.recordist)],
  ["Edited by", esc(t.editor)],
  ["Reviewed by", esc(t.subtitleEditorsReviewers)],
  ["Equipment", esc(t.oralHistory?.recordingEquipment)],
  ["Length", mins(t.duration)],
  ["Licence", esc(LICENCE[t.license] || t.license)],
  ["Deposited at", deposits(it)],
  ["Metadata", `<a href="${u(`${s.id}/${it.id}.json`)}">Tome record (JSON)</a><br><a href="${u(`${s.id}/${it.id}.dc.xml`)}">Dublin Core (XML)</a>`],
])}
${t.description ? `<p class="desc">${esc(plain(t.description))}</p>` : ""}
<h4>Files</h4>
<ul class="filelist">${files.map((f) => `<li><span class="fname">${esc(f.name)}</span><span class="fmeta">${esc(f.what)}</span>${pid(f.name)}<a class="get" href="${esc(f.href)}">Download</a></li>`).join("")}</ul>
${citeBox(cite)}
</div></article>`;
}

export function sessionPage(s, collections) {
  const c = s.collection;
  const people = s.people.map((p) => p.name);
  const body = `<div class="wrap collection">
<p class="crumbs"><a href="${u("")}#languages">Languages</a> / <a href="${u(c.iso + "/")}">${esc(c.language)}</a>${s.variety ? ` / ${esc(s.variety)}` : ""} / Session ${s.n}</p>
<div class="chead"><div><h1 class="display small">${esc(names(people))}</h1><p class="project">${esc([s.project, s.variety || c.language].filter(Boolean).join(", "))}</p>${pid(s.id)}</div>${s.portrait ? `<img src="${esc(s.portrait.src)}" alt="${esc(people[0])}">` : ""}</div>
${fields([
  ["Language", `<a href="${u(c.iso + "/")}">${esc(c.language)}</a> (${c.iso})`],
  ["Variety", esc(s.variety)],
  ["People", s.people.map((p) => `${esc(p.name)}${p.role && p.role !== "Participant" ? ` (${esc(p.role.toLowerCase())})` : ""}`).join("<br>")],
  ["Place", esc(s.place)],
  ["Recorded", esc(s.date)],
  ["Recorded by", esc(s.recordist)],
  ["Project", esc(s.project)],
  ["Items", String(s.items.length)],
])}
<h2 class="sub">Items</h2>
<div class="items">${s.items.map(itemSection).join("\n")}</div>
${credits(people, s.recordist ? [s.recordist] : [], [s.portrait && { ...s.portrait, of: people[0] }], subtitleCredits(s))}
</div>`;
  return shell({ title: `${names(people)}, ${c.language} – ${SITE_NAME}`, body, collections, active: c.iso });
}

export function wordlistPage(w, collections) {
  const c = w.collection;
  const body = `<div class="wrap collection">
<p class="crumbs"><a href="${u("")}#languages">Languages</a> / <a href="${u(c.iso + "/")}">${esc(c.language)}</a> / Word lists</p>
<div class="chead"><div><h1 class="display small">${esc(w.title)}</h1><p class="project">${esc(w.speaker)}</p>${pid(w.id)}</div></div>
<div class="two">
${fields([
  ["Language", `<a href="${u(c.iso + "/")}">${esc(c.language)}</a> (${c.iso})`],
  ["Variety", esc(w.dialect)],
  ["Speaker", esc(w.speaker)],
  ["Recorded", esc(w.date)],
  ["Recorded by", esc(w.recordist)],
  ["Recorded with", esc(w.tool)],
  ["Words", w.words.length.toLocaleString("en-IN")],
  ["Licence", esc(LICENCE[w.license] || w.license)],
  ["Deposited at", (w.deposits || []).map((d) => `<a href="${esc(d.url)}">${esc(d.label)}</a>${d.id ? ` (${esc(d.id)})` : ""}`).join("<br>")],
  ["Download", `<a href="${u(`${w.id}/${w.id}.csv`)}">${esc(w.id)}.csv</a>`],
])}
${citeBox(`${w.speaker}. ${w.title}. ${c.language} [${c.iso}]. ${SITE_NAME}. ${arkUrl(w.id)}`)}
</div>
${w.description ? `<p class="desc">${esc(w.description)}</p>` : ""}
<h2 class="sub">Words</h2>
<div class="words" data-src="${u(`${w.id}/words.json`)}" data-id="${esc(arkName(w.id))}" data-url="${arkUrl(w.id)}">
<label for="find">Find a word</label>
<input id="find" type="search" autocomplete="off" spellcheck="false">
<p class="words-count" aria-live="polite">Loading the word list…</p>
<ol class="wordrows"></ol>
<div class="pager"><button type="button" class="prev">Previous</button><button type="button" class="next">Next</button></div>
<audio class="sayer" preload="none"></audio>
</div>
${credits([w.speaker], w.recordist ? [w.recordist] : [], [])}
</div>`;
  return shell({ title: `${w.title} – ${SITE_NAME}`, body, collections, active: c.iso });
}

export function aboutPage(collections) {
  const body = `<div class="wrap prose">
<h1 class="display small">how the archive is kept</h1>
<p>The archive has one collection for each language. A collection page lists the language's varieties and the recording sessions made with speakers of each. Jaunpuri, for example, sits under Garhwali, and Johari sits under Kumaoni.</p>
<p>A session is one sitting with a speaker, or sometimes two or three people talking together. One session often covers several topics, so it can hold more than one item. An item is a video or sound recording together with its subtitles, and each file is named after its item, so <code>juy002.webm</code> and <code>juy002.en.srt</code> belong together.</p>
<p>Collections, sessions, items and files each have their own permanent identifier. Click one to copy its link.</p>
<p>The metadata for each item is written in Tome and kept here as the Tome record, unchanged. You can download that record, open it in Tome and use it to describe the same recording somewhere else, such as Wikimedia Commons. Each item also has a Dublin Core version for library and archive systems.</p>
<p>Where we've deposited a copy with Language Archive Cologne or Wikimedia Commons, the item's details list it. The full set of records is on the <a href="${u("data/")}">data page</a>.</p>
</div>`;
  return shell({ title: `About – ${SITE_NAME}`, body, collections });
}

export function dataPage(collections, total) {
  const body = `<div class="wrap prose">
<h1 class="display small">data</h1>
<p>All ${total} item records can be downloaded at once. The Tome records are the ones we keep, and the other formats are made from them each time the site is built.</p>
${fields([
  ["Tome records", `<a href="${u("data/records.json")}">records.json</a>`],
  ["Dublin Core", `<a href="${u("data/dublin-core.xml")}">dublin-core.xml</a>`],
  ["Spreadsheet", `<a href="${u("data/records.csv")}">records.csv</a>`],
])}
<p>Each item's own records and subtitle files are listed on its session page.</p>
</div>`;
  return shell({ title: `Data – ${SITE_NAME}`, body, collections });
}

export function csvRows(items) {
  const cols = ["id", "ark", "session", "title", "language", "languageISO", "dialect", "people", "recordingPlace", "date", "recordist", "fileType", "duration", "license", "subtitles"];
  const q = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const rows = items.map((it) => {
    const t = it.tome;
    return [it.id, arkName(it.id), it.session.id, plain(t.title), t.language, isoOf(t), t.dialect, names((t.interviewees || []).map((p) => p.fullName)), t.recordingPlace, t.date || t.year, t.recordist, t.fileType, t.duration, t.license, it.subtitles.map((s) => s.language).join(" ")].map(q).join(",");
  });
  return [cols.join(","), ...rows].join("\n") + "\n";
}
