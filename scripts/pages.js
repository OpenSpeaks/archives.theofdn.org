import { BASE, arkName, arkUrl } from "./config.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isoOf, plain, mediaUrl, posterUrl, peopleOf, QIDS, PROJECTS } from "./records.js";
import { personKey, languageKey } from "./data-strings.js";
import { ROOT } from "./config.js";
import { t, raw, lookup, page, getLang, LANGS, STRINGS, DATA, CLIENT } from "./strings.js";

const LOGO = readFileSync(join(ROOT, "assets", "logo.svg"), "utf8").trim();

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// files and data stay at the root for every language
const u = (path) => BASE + path.replace(/^\//, "");
const site = () => raw("siteName");

// names and record text in the page language, from strings/data/<code>.json
const dt = (key, fallback) => (getLang() !== "en" && DATA[getLang()][key]) || fallback;
export const langOf = (c) => dt(languageKey(c), c.language);
const placeOf = (p) => dt(`place.${p}`, p);
const who = (name) => dt(personKey({ name, qid: QIDS.get(name) }), name);
const varietyOf = (v) => dt(`variety.${v}`, v);
const projectOf = (p) => dt(`project.${p}`, p);
function projectLink(p) {
  const x = PROJECTS[p];
  if (!x) return esc(projectOf(p));
  const name = x.wikidata ? `<a href="https://www.wikidata.org/wiki/${x.wikidata}">${esc(projectOf(p))}</a>` : esc(projectOf(p));
  return x.lccn ? `${name} (<a href="https://lccn.loc.gov/${x.lccn}">LCCN ${x.lccn}</a>)` : name;
}
// Tome's own text in the page language comes first
const inLang = (list) => (list || []).find((x) => x.langCode === getLang() && x.text)?.text;
const titleOf = (it) => plain((getLang() !== "en" && inLang(it.tome.extraTitles)) || dt(`${it.id}.title`, it.tome.title));
const descOf = (it) => plain((getLang() !== "en" && inLang(it.tome.extraDescriptions)) || dt(`${it.id}.description`, it.tome.description));

const displayNames = {};
function displayName(type, code) {
  const key = getLang() + type;
  displayNames[key] ||= new Intl.DisplayNames([getLang(), "en"], { type, fallback: "none" });
  try { return displayNames[key].of(code); } catch { return undefined; }
}

// en -> English, gju-deva -> Gujari (Devanagari), using the collection's own name for its code
export function trackLabel(code, col) {
  const [base, script] = code.split("-");
  const name = base === col.iso ? col.language : displayName("language", base) || base;
  const s = script?.length === 4 && displayName("script", script[0].toUpperCase() + script.slice(1));
  return s ? `${name} (${s})` : name;
}

export function names(list) {
  if (list.length < 2) return list.join("");
  return list.slice(0, -1).join(", ") + raw("and") + list[list.length - 1];
}

// Tome role codes, shown in the page language
const role = (r) => {
  const key = "role" + r.trim().charAt(0).toUpperCase() + r.trim().slice(1).toLowerCase();
  return key in STRINGS.en ? raw(key) : r.trim();
};
const roles = (list) => list.map(role).join(", ");

function mins(s) {
  const n = Math.round(Number(s));
  if (!n) return "";
  return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
}

const LICENCE = { "cc-by-sa-4.0": "CC BY-SA 4.0", "cc-by-4.0": "CC BY 4.0", "cc-zero": "CC0" };
const COPY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1h9v11H5zM2 4v11h9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

// the short id on show, the full link on the clipboard
export function pid(id) {
  return `<button type="button" class="pid" data-url="${arkUrl(id)}" aria-label="${t("copyLink", { id: esc(arkName(id)) })}"><code>${esc(arkName(id))}</code>${COPY_ICON}<span class="pid-done" aria-live="polite"></span></button>`;
}

function fields(rows) {
  return `<dl class="fields">${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${t(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}

function citeBox(text) {
  return `<div class="cite"><span>${t("cite")}</span><p>${esc(text)}</p><button type="button" class="copy" data-cite="${esc(text)}">${t("copy")}</button></div>`;
}

// handle prefixes of the archives we deposit with
const HANDLE_PREFIX = { "11341": "Language Archive Cologne", "2196": "Endangered Languages Archive" };
const handleArchive = (h) => HANDLE_PREFIX[String(h).split("/")[0]] || "Handle " + h;

function deposits(item) {
  const tm = item.tome;
  const out = [];
  for (const i of (tm.identifiers || []).filter((x) => x.value?.trim())) {
    if (i.prop === "P1184") out.push(`<a href="https://hdl.handle.net/${esc(i.value)}">${handleArchive(i.value)}</a>`);
  }
  if (tm.onCommons && tm.fileName) out.push(`<a href="https://commons.wikimedia.org/wiki/File:${esc(encodeURIComponent(tm.fileName.replaceAll(" ", "_")))}">Wikimedia Commons</a>`);
  return out.join("<br>");
}

function ticks(collections, active) {
  return collections.map((c) => `<a href="${page(c.iso + "/")}" class="${c.iso === active ? "on" : ""}" title="${esc(langOf(c))}" aria-label="${esc(langOf(c))}"${c.iso === active ? ' aria-current="page"' : ""}></a>`).join("");
}

function subtitleCredits(s) {
  const found = new Set();
  for (const it of s.items) for (const x of it.subtitles) for (const p of subtitlers(it.tome, x.language, s.collection)) found.add(p.replace(/ \([^)]*\)$/, ""));
  return [...found];
}

function credits(people, recordists, photos, subtitlersList = []) {
  const seen = new Set();
  const pics = photos.filter((p) => p && !seen.has(p.src) && seen.add(p.src));
  return `<section class="credits-page"><h2>${t("creditsTitle")}</h2>
<p>${t("creditsPeople", { names: esc(names(people.map(who))) })}</p>
${recordists.length ? `<p>${t("creditsRecorded", { names: esc(names(recordists.map(who))) })}</p>` : ""}
${subtitlersList.length ? `<p>${t("creditsSubtitles", { names: esc(names(subtitlersList)) })}</p>` : ""}
${pics.length ? `<p>${t("creditsPhotos", { list: pics.map((p) => t("creditsPhoto", { of: esc(p.of), by: esc(p.by) })).join("; ") })}</p>` : ""}
</section>`;
}

// language codes as outlines from Noto Sans Bold and Noto Sans Oriya Bold, so they look the same without the fonts
const CODES = {
  en: ["16.71 10.0", "M5.8 10H0V0H5.8V1.7H2.1V3.9H5.5V5.7H2.1V8.2H5.8ZM16.7 10H14L9.7 2.4H9.6Q9.6 3.2 9.7 3.9Q9.7 4.6 9.7 5.3V10H7.8V0H10.5L14.9 7.5H14.9Q14.9 6.8 14.9 6.1Q14.8 5.4 14.8 4.7V0H16.7Z"],
  or: ["9.93 10.73", "M5.8 10.7Q4 10.7 2.7 10.1Q1.4 9.5 0.7 8.3Q0 7.2 0 5.6Q0 3.9 0.7 2.5Q1.4 1.1 2.7 0L4.1 1.3Q3.5 1.8 3.1 2.4Q2.6 3.1 2.3 3.9Q2 4.7 2 5.6Q2 6.6 2.5 7.3Q2.9 8.1 3.8 8.5Q4.6 8.9 5.8 8.9Q6.8 8.9 7.4 8.6Q7.9 8.3 7.9 7.8Q7.9 7.4 7.6 7.2Q7.2 7 6.6 7Q5.9 7 5.1 7.3L4.3 5.8L6.3 5.1Q6.6 5 6.9 4.9Q7.3 4.7 7.5 4.5Q7.8 4.2 7.8 3.8Q7.8 3.5 7.5 3.2Q7.2 3 6.8 3Q6.3 3 6.1 3.3Q5.8 3.5 5.8 3.9Q5.8 4.1 6 4.5L4.1 5.1Q3.8 4.3 3.8 3.6Q3.8 2.5 4.6 1.9Q5.4 1.3 6.8 1.3Q8.3 1.3 9 2Q9.8 2.6 9.8 3.6Q9.8 4.2 9.5 4.6Q9.3 5 9 5.3Q8.6 5.6 8.2 5.8Q9.1 6.1 9.5 6.6Q9.9 7.2 9.9 8Q9.9 9.3 8.8 10Q7.8 10.7 5.8 10.7Z"],
};

function code(l) {
  const name = esc(STRINGS[l].langName);
  if (!CODES[l]) return name;
  const [size, d] = CODES[l];
  return `<svg viewBox="0 0 ${size}" role="img" aria-label="${name}"><path d="${d}"/></svg>`;
}

// every language as a short code, the current one marked; a menu once there are more than two
function switcher(path) {
  if (path === null) return "";
  const codes = LANGS.map((l) => l === getLang()
    ? `<span class="on" lang="${l}" aria-current="true" title="${esc(STRINGS[l].langName)}">${code(l)}</span>`
    : `<a href="${page(path, l)}" lang="${l}" hreflang="${l}" title="${esc(STRINGS[l].langName)}">${code(l)}</a>`);
  return `<span class="switch" role="group" aria-label="${t("navLanguage")}">${codes.join("")}</span>`;
}

// title comes in escaped; path null for pages only in English
export function shell({ title, path, body, collections, active = "", head = "", script = "" }) {
  const at = collections.findIndex((c) => c.iso === active);
  const pad = (n) => String(n).padStart(3, "0");
  const strings = Object.fromEntries(CLIENT.map((k) => [k, lookup(k)]));
  return `<!doctype html>
<html lang="${getLang()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${t("metaDescription")}">
${path === null ? "" : LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${page(path, l)}">`).join("\n")}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&family=Inter+Tight:wght@600..900&display=swap">
<link rel="stylesheet" href="${u("style.css")}">
${head}</head>
<body>
<a class="skip" href="#main">${t("skip")}</a>
<header class="paper">
  <div class="wrap bar">
    <a class="mark" href="${page("")}">${LOGO}</a>
    <nav aria-label="${t("navMain")}">
      <a href="${page("")}#languages">${t("navLanguages")}</a>
      <a href="${page("data/")}">${t("navData")}</a>
      <a href="${page("about/")}">${t("navAbout")}</a>
      ${switcher(path)}
    </nav>
  </div>
  <div class="wrap"><nav class="ticks" aria-label="${t("navLanguages")}">${ticks(collections, active)}</nav></div>
</header>
<main id="main">
${body}
</main>
<footer class="paper">
  <div class="wrap"><div class="ticks" aria-hidden="true">${collections.map((c) => `<span class="${c.iso === active ? "on" : ""}"></span>`).join("")}</div></div>
  <div class="wrap footcols">
    <nav aria-label="${t("footArchive")}"><h2>${t("footArchive")}</h2><ul><li><a href="${page("about/")}">${t("navAbout")}</a></li><li><a href="${page("")}#languages">${t("navLanguages")}</a></li><li><a href="${page("data/")}">${t("navData")}</a></li></ul></nav>
    <nav aria-label="${t("footGuides")}"><h2>${t("footGuides")}</h2><ul><li><a href="https://archivingthepresent.cc/manual/appendix-b/">${t("guideFramework")}</a></li><li><a href="https://archivingthepresent.cc/manual/appendix-a/">${t("guideStyle")}</a></li></ul></nav>
    <nav aria-label="${t("footTools")}"><h2>${t("footTools")}</h2><ul><li><a href="https://tome.toolforge.org/">Tome</a></li><li><a href="https://subtitler.toolforge.org/">Subtitler</a></li><li><a href="https://bento.toolforge.org/">Bento</a></li></ul></nav>
  </div>
  <div class="wrap bar">
    <span></span>
    <svg class="logo" viewBox="-4 -1 96 96" role="img" aria-label="OpenSpeaks"><path d="M46.92,3.92C23.22,4.05,3.79,23.35,3.79,47.18c0,9.71,3.25,19.13,9.28,26.79L-.39,86.14c-1.69,1.52-.6,4.31,1.66,4.31h45.65c23.84,0,43.13-19.26,43.26-43.13,0-11.47-4.41-22.34-12.66-30.6-8.09-8.22-19-12.66-30.6-12.79ZM46.92,83.81h-.13l-34.74-.13,10.31-9.28-2.22-2.49c-6.17-6.76-9.71-15.61-9.71-24.86,0-20.02,16.48-36.33,36.5-36.33,9.85,0,19,3.81,25.89,10.74,6.93,6.93,10.74,16.18,10.61,25.89.12,20.15-16.36,36.46-36.51,36.46Z"/><circle cx="34.12" cy="48.15" r="3.51"/><circle cx="45.63" cy="48.15" r="3.51"/><circle cx="57.13" cy="48.15" r="3.51"/></svg>
    <span class="count">${pad(at + 1)}/${pad(collections.length)}</span>
  </div>
  <div class="wrap credits"><p>${t("footNote", { year: new Date().getFullYear(), site: esc(site()), host: t("hostName"), cc: `<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>`, code: `<a href="https://github.com/OpenSpeaks/archives.theofdn.org/blob/main/LICENSE">${t("siteCode")}</a>` })}</p></div>
</footer>
<script>var STRINGS = ${JSON.stringify(strings).replace(/</g, "\\u003c")};</script>
${script}<script src="${u("site.js")}"></script>
</body>
</html>
`;
}

const count = (c) => c.sessions.reduce((m, s) => m + s.items.length, 0);
const title = (...parts) => [...parts.map(esc), esc(site())].join(" – ");

export function home(collections, places) {
  const sessions = collections.reduce((n, c) => n + c.sessions.length, 0);
  const items = collections.reduce((n, c) => n + count(c), 0);
  const words = collections.reduce((n, c) => n + c.wordlists.reduce((m, w) => m + w.words.length, 0), 0);
  const body = `<section class="wrap intro">
<h1 class="display">${t("homeTitle", { n: collections.length })}</h1>
<p class="lede">${t("homeLede", { sessions, items, words: words.toLocaleString("en-IN") })}</p>
</section>
<section class="map-band" aria-label="${t("homeMap")}"><div id="atlas"></div></section>
<section class="wrap index" id="languages"><h2>${t("navLanguages")}</h2><ul class="langs">
${collections.map((c) => `<li><a href="${page(c.iso + "/")}"><span class="code">${c.iso.toUpperCase()}</span><span><span class="lname">${esc(langOf(c))}</span><span class="lplace">${esc(placeOf(c.place))}</span></span><span class="num">${t("homeCount", { sessions: c.sessions.length, items: count(c) })}</span></a></li>`).join("\n")}
</ul></section>`;
  return shell({
    title: esc(site()), path: "", body, collections,
    head: `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">\n`,
    script: `<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>\n<script>var places = ${JSON.stringify(places)};</script>\n`,
  });
}

const itemCount = (n) => t(n === 1 ? "itemOne" : "itemMany", { n });

function sessionRow(s) {
  return `<li><a href="${page(s.id + "/")}">${s.portrait ? `<img src="${esc(s.portrait.src)}" alt="">` : '<span class="noimg"></span>'}<span><span class="lname">${esc(names(s.speakers.map(who)))}</span><span class="lplace">${s.items.map((it) => esc(titleOf(it))).join(", ")}</span></span><span class="num">${itemCount(s.items.length)}</span></a></li>`;
}

export function collectionPage(c, collections) {
  const groups = new Map();
  for (const s of c.sessions) {
    if (!groups.has(s.variety)) groups.set(s.variety, []);
    groups.get(s.variety).push(s);
  }
  const projects = [...new Set(c.sessions.flatMap((s) => s.projects))];
  const varieties = [...groups.keys()].filter(Boolean);
  const people = [...new Set(c.sessions.flatMap((s) => s.people.map((p) => p.name)))];
  const recordists = [...new Set(c.sessions.flatMap((s) => s.recordists))];
  const photos = [c.cover && { ...c.cover, of: raw("cover") }, ...c.sessions.map((s) => s.portrait && { ...s.portrait, of: who(s.people[0]?.name || "") })];
  const extras = c.extras.length ? `<h2 class="sub">${t("otherFiles")}</h2>
<ul class="filelist">${c.extras.map((x) => `<li id="${x.id.split("-")[1]}"><span class="fname">${esc(x.title)}</span><span class="fmeta">${esc(x.fileName)}</span>${pid(x.id)}<a class="get" href="${esc(x.url)}">${t("open")}</a></li>`).join("")}</ul>` : "";
  const body = `<div class="wrap collection">
<p class="crumbs"><a href="${page("")}#languages">${t("navLanguages")}</a> / ${esc(langOf(c))}</p>
<div class="chead"><div><h1 class="display">${esc(langOf(c))}</h1><p class="project">${esc(projects.map(projectOf).join(", "))}</p>${pid(c.iso)}</div>${c.cover ? `<img src="${esc(c.cover.src)}" alt="">` : ""}</div>
<div class="two">
${fields([
  ["fieldLanguage", `${esc(langOf(c))} (${c.iso})`],
  ["fieldVarieties", esc(varieties.map(varietyOf).join(", "))],
  ["fieldProjects", projects.map(projectLink).join("<br>")],
  ["fieldPlace", esc(placeOf(c.place))],
  ["fieldSessions", String(c.sessions.length)],
  ["fieldItems", String(count(c))],
  ["fieldDeposited", (c.deposits || []).map((d) => `<a href="${esc(d.url)}">${esc(d.label)}</a>`).join("<br>")],
])}
${citeBox(`${c.language} [${c.iso}]. ${site()}. ${arkUrl(c.iso)}`)}
</div>
${[...groups].map(([variety, list]) => `<h2 class="sub">${variety ? esc(varietyOf(variety)) : t("recordingSessions")}</h2>\n<ol class="recs">${list.map(sessionRow).join("")}</ol>`).join("\n")}
${c.wordlists.length ? `<h2 class="sub">${t("wordLists")}</h2>\n<ol class="recs">${c.wordlists.map((w) => `<li><a href="${page(w.id + "/")}"><span class="noimg"></span><span><span class="lname">${esc(dt(`${w.id}.title`, w.title))}</span><span class="lplace">${esc(who(w.speaker))}${w.dialect ? `, ${esc(varietyOf(w.dialect))}` : ""}</span></span><span class="num">${t("wordCount", { n: w.words.length.toLocaleString("en-IN") })}</span></a></li>`).join("")}</ol>` : ""}
${extras}
${credits([...people, ...c.wordlists.map((w) => w.speaker)].filter((p, i, a) => a.indexOf(p) === i), recordists, photos)}
</div>`;
  return shell({ title: title(langOf(c)), path: c.iso + "/", body, collections, active: c.iso });
}

function player(it) {
  const tm = it.tome;
  const c = it.session.collection;
  const src = mediaUrl(tm);
  const tracks = it.subtitles.map((s) => ({ src: u(`${it.session.id}/${it.id}.${s.language}.vtt`), lang: s.language.split("-")[0], label: trackLabel(s.language, c) }));
  if (!src) {
    const handle = (tm.identifiers || []).find((i) => i.prop === "P1184" && i.value?.trim());
    const poster = posterUrl(tm);
    return `<div class="frame">${poster ? `<img src="${esc(poster)}" alt="" loading="lazy">` : ""}${handle ? `<a class="away" href="https://hdl.handle.net/${esc(handle.value)}">${t("watchAt", { archive: handleArchive(handle.value) })} &rarr;</a>` : ""}</div>`;
  }
  if (tm.fileType === "audio") return `<div class="sound"><audio controls preload="none" src="${esc(src)}"></audio></div>`;
  return `<div class="frame"><img src="${esc(posterUrl(tm))}" alt="" loading="lazy"><button type="button" class="play" data-src="${esc(src)}" data-tracks="${esc(JSON.stringify(tracks))}">${t("play")}${mins(tm.duration) ? " " + mins(tm.duration) : ""}</button></div>
<button type="button" class="full" hidden>${t("fullScreen")}</button>`;
}

const withRoles = (list) => list.map((p) => {
  const shown = p.roles.filter((r) => r.toLowerCase() !== "participant");
  return `${esc(who(p.name))}${shown.length ? ` (${esc(roles(shown))})` : ""}`;
}).join("<br>");

// who made a subtitle track, from the Tome record; Tome may store the track language as a code or a name
function subtitlers(tm, language, c) {
  const tracks = [{ language: tm.subtitleLanguage, creators: tm.subtitleCreators, editorsReviewers: tm.subtitleEditorsReviewers }, ...(tm.additionalSubtitles || [])];
  const users = new Set(Object.values(tm.timedTextAuthors || {}));
  const track = tracks.find((x) => x.language === language || x.language === trackLabel(language, c)) || {};
  return [track.creators, track.editorsReviewers].filter(Boolean).join(",").split(",").map((p) => p.trim()).filter(Boolean)
    .map((p) => p.replace(/ \(subtitler\)$/, "")).map((p) => (users.has(p.replace(/ \(editor\)$/, "")) ? raw("commonsUser", { name: p }) : p));
}

// an item repeats a session field only when its own value is different
const differs = (value, session) => (value && value !== session ? esc(value) : "");
const samePeople = (a, b) => JSON.stringify(a.map((p) => [p.name, [...p.roles].sort()])) === JSON.stringify(b.map((p) => [p.name, [...p.roles].sort()]));

function itemSection(it) {
  const tm = it.tome;
  const s = it.session;
  const c = s.collection;
  const name = plain(tm.title);
  const year = (String(tm.date || tm.year).match(/\d{4}/) || [""])[0];
  const cite = `${names(s.speakers)}${year ? ` (${year})` : ""}. ${name}. ${c.language} [${c.iso}]. ${site()}. ${arkUrl(it.id)}`;
  const ext = (tm.fileName?.split(".").pop() || tm.format || "").toLowerCase();
  const subtitleWhat = (x) => {
    const by = subtitlers(tm, x.language, c);
    const language = esc(trackLabel(x.language, c));
    return by.length ? t("subtitlesInBy", { language, names: esc(by.join(", ")) }) : t("subtitlesIn", { language });
  };
  const files = [
    ...(mediaUrl(tm) ? [{ id: `${it.id}/${ext}`, name: `${it.id}.${ext}`, what: t(tm.fileType === "audio" ? "sound" : "video"), href: mediaUrl(tm) }] : []),
    ...it.subtitles.map((x) => ({ id: `${it.id}/${x.language}/srt`, name: `${it.id}.${x.language}.srt`, what: subtitleWhat(x), href: u(`${s.id}/${it.id}.${x.language}.srt`) })),
  ];
  return `<article class="item" id="${it.id}"><div class="item-play">${player(it)}</div>
<div class="item-meta"><h3>${esc(titleOf(it))}</h3>
${pid(it.id)}
${fields([
  ["fieldPartOf", `${t("session", { n: s.n })}, <code>${esc(arkName(s.id))}</code>`],
  ["fieldOtherTitles", [...(tm.extraTitles || []).filter((e) => e.langCode === c.iso).map((e) => e.text), ...(titleOf(it) !== name ? [name] : [])].map(esc).join("<br>")],
  ["fieldLanguage", isoOf(tm) && isoOf(tm) !== c.iso ? `${esc(tm.language)} (${esc(isoOf(tm))})` : ""],
  ["fieldVariety", [tm.dialect !== s.variety ? esc(varietyOf(tm.dialect || "")) : "", tm.dialectNames && t("alsoCalled", { names: esc(tm.dialectNames) })].filter(Boolean).join(", ")],
  ["fieldPeople", samePeople(peopleOf(tm), s.people) ? "" : withRoles(peopleOf(tm))],
  ["fieldPlace", tm.recordingPlace && tm.recordingPlace !== s.place ? esc(placeOf(tm.recordingPlace)) : ""],
  ["fieldRecorded", differs(tm.date || tm.year, s.date)],
  ["fieldRecordedBy", tm.recordist && tm.recordist !== s.recordist ? esc(who(tm.recordist)) : ""],
  ["fieldEditedBy", esc(tm.editor && who(tm.editor))],
  ["fieldReviewedBy", esc(tm.subtitleEditorsReviewers)],
  ["fieldEquipment", esc(tm.oralHistory?.recordingEquipment)],
  ["fieldLength", mins(tm.duration)],
  ["fieldLicence", esc(LICENCE[tm.license] || tm.license)],
  ["fieldDeposited", deposits(it)],
  ["fieldMetadata", `<a href="${u(`${s.id}/${it.id}.json`)}">${t("tomeRecord")}</a><br><a href="${u(`${s.id}/${it.id}.dc.xml`)}">${t("dublinCore")}</a>`],
])}
${tm.description ? `<p class="desc">${esc(descOf(it))}</p>` : ""}
<h4>${t("files")}</h4>
<ul class="filelist">${files.map((f) => `<li><span class="fname">${esc(f.name)}</span><span class="fmeta">${f.what}</span>${pid(f.id)}<a class="get" href="${esc(f.href)}">${t("download")}</a></li>`).join("")}</ul>
${citeBox(cite)}
</div></article>`;
}

export function sessionPage(s, collections) {
  const c = s.collection;
  const people = s.speakers;
  const everyone = s.people.map((p) => p.name);
  const session = t("session", { n: s.n });
  const body = `<div class="wrap collection">
<p class="crumbs"><a href="${page("")}#languages">${t("navLanguages")}</a> / <a href="${page(c.iso + "/")}">${esc(langOf(c))}</a>${s.variety ? ` / ${esc(varietyOf(s.variety))}` : ""} / ${session}</p>
<div class="chead"><div><h1 class="display small">${esc(names(people.map(who)))}</h1><p class="project">${esc([...s.projects.map(projectOf), s.variety ? varietyOf(s.variety) : langOf(c)].filter(Boolean).join(", "))}</p>${pid(s.id)}</div>${s.portrait ? `<img src="${esc(s.portrait.src)}" alt="${esc(who(people[0]))}">` : ""}</div>
${fields([
  ["fieldLanguage", `<a href="${page(c.iso + "/")}">${esc(langOf(c))}</a> (${c.iso})`],
  ["fieldVariety", esc(s.variety && varietyOf(s.variety))],
  ["fieldPeople", withRoles(s.people)],
  ["fieldPlace", (s.places.length ? s.places : [s.place]).map((p) => esc(placeOf(p))).join("<br>")],
  ["fieldRecorded", esc(s.date)],
  ["fieldRecordedBy", esc(s.recordists.map(who).join(", "))],
  [s.projects.length > 1 ? "fieldProjects" : "fieldProject", s.projects.map(projectLink).join("<br>")],
  ["fieldItems", String(s.items.length)],
])}
<h2 class="sub">${t("items")}</h2>
<div class="items">${s.items.map(itemSection).join("\n")}</div>
${credits(everyone, s.recordists, [s.portrait && { ...s.portrait, of: who(people[0]) }], subtitleCredits(s))}
</div>`;
  return shell({ title: title(`${names(people.map(who))}, ${langOf(c)}`), path: s.id + "/", body, collections, active: c.iso });
}

export function wordlistPage(w, collections) {
  const c = w.collection;
  const body = `<div class="wrap collection">
<p class="crumbs"><a href="${page("")}#languages">${t("navLanguages")}</a> / <a href="${page(c.iso + "/")}">${esc(langOf(c))}</a> / ${t("wordLists")}</p>
<div class="chead"><div><h1 class="display small">${esc(dt(`${w.id}.title`, w.title))}</h1><p class="project">${esc(who(w.speaker))}</p>${pid(w.id)}</div></div>
<div class="two">
${fields([
  ["fieldLanguage", `<a href="${page(c.iso + "/")}">${esc(langOf(c))}</a> (${c.iso})`],
  ["fieldVariety", esc(w.dialect && varietyOf(w.dialect))],
  ["fieldSpeaker", esc(who(w.speaker))],
  ["fieldRecorded", esc(w.date)],
  ["fieldRecordedBy", esc(w.recordist && who(w.recordist))],
  ["fieldRecordedWith", esc(w.tool)],
  ["fieldWords", w.words.length.toLocaleString("en-IN")],
  ["fieldLicence", esc(LICENCE[w.license] || w.license)],
  ["fieldDeposited", (w.deposits || []).map((d) => `<a href="${esc(d.url)}">${esc(d.label)}</a>${d.id ? ` (${esc(d.id)})` : ""}`).join("<br>")],
  ["fieldDownload", `<a href="${u(`${w.id}/${w.id}.csv`)}">${esc(w.id)}.csv</a>`],
])}
${citeBox(`${w.speaker}. ${w.title}. ${c.language} [${c.iso}]. ${site()}. ${arkUrl(w.id)}`)}
</div>
${w.description ? `<p class="desc">${esc(dt(`${w.id}.description`, w.description))}</p>` : ""}
<h2 class="sub">${t("fieldWords")}</h2>
<div class="words" data-src="${u(`${w.id}/words.json`)}" data-id="${esc(arkName(w.id))}" data-url="${arkUrl(w.id)}">
<label for="find">${t("findWord")}</label>
<input id="find" type="search" autocomplete="off" spellcheck="false">
<p class="words-count" aria-live="polite">${t("wordsLoading")}</p>
<ol class="wordrows"></ol>
<div class="pager"><button type="button" class="prev">${t("previous")}</button><button type="button" class="next">${t("next")}</button></div>
<audio class="sayer" preload="none"></audio>
</div>
${credits([w.speaker], w.recordist ? [w.recordist] : [], [])}
</div>`;
  return shell({ title: title(dt(`${w.id}.title`, w.title)), path: w.id + "/", body, collections, active: c.iso });
}

export function aboutPage(collections) {
  const sessions = collections.flatMap((c) => c.sessions);
  const items = sessions.flatMap((s) => s.items);
  const subtitles = items.reduce((n, it) => n + it.subtitles.length, 0);
  const words = collections.flatMap((c) => c.wordlists).reduce((n, w) => n + w.words.length, 0);
  const body = `<div class="wrap prose">
<h1 class="display small">${t("aboutTitle")}</h1>
<p>${t("aboutIntro", { n: collections.length })}</p>
<h2>${t("aboutArrangedTitle")}</h2>
<p>${t("aboutArranged")}</p>
<p>${t("aboutCounts", { sessions: sessions.length, items: items.length, subtitles, words: words.toLocaleString("en-GB") })}</p>
<h2>${t("aboutIdsTitle")}</h2>
<p>${t("aboutIds", { example: "<code>ark:15056/osa-juy001</code>" })}</p>
<h2>${t("aboutDepositsTitle")}</h2>
<p>${t("aboutDeposits")}</p>
<h2>${t("aboutRecordsTitle")}</h2>
<p>${t("aboutRecords", { tome: '<a href="https://tome.toolforge.org/">Tome</a>', data: `<a href="${page("data/")}">${t("aboutDataLink")}</a>` })}</p>
<h2>${t("aboutEditTitle")}</h2>
<p>${t("aboutEdit", { guide: `<a href="https://github.com/OpenSpeaks/archives.theofdn.org/blob/main/CONTRIBUTING.md">${t("aboutGuideLink")}</a>` })}</p>
</div>`;
  return shell({ title: title(raw("navAbout")), path: "about/", body, collections });
}

// theofdn.org sends ids it has no page for here, as /ark/#<id>
export function arkPage(collections) {
  const body = `<div class="wrap prose">
<h1 class="display small">${t("arkTitle")}</h1>
<p class="ark-note" aria-live="polite">${t("arkLooking")}</p>
</div>`;
  const script = `<script>
(function () {
  var id = decodeURIComponent(location.hash.slice(1)), note = document.querySelector(".ark-note");
  var word = /^([a-z]{3}-w\\d+)-(\\d+)$/.exec(id);
  if (word) return location.replace("${u("")}" + word[1] + "/#" + Number(word[2]));
  fetch("${u("ark.json")}").then(function (r) { return r.json(); }).then(function (d) {
    if (d.targets[id]) location.replace(d.targets[id]);
    else note.textContent = ${JSON.stringify(lookup("arkMissing"))}.replace("{id}", id || "?");
  });
})();
</script>
`;
  return shell({ title: title(raw("arkHeading")), path: null, body, collections, script });
}

export function dataPage(collections, total) {
  const body = `<div class="wrap prose">
<h1 class="display small">${t("dataTitle")}</h1>
<p>${t("dataIntro", { n: total })}</p>
${fields([
  ["dataTome", `<a href="${u("data/records.json")}">records.json</a>`],
  ["dataDublinCore", `<a href="${u("data/dublin-core.xml")}">dublin-core.xml</a>`],
  ["dataSpreadsheet", `<a href="${u("data/records.csv")}">records.csv</a>`],
])}
<p>${t("dataEach")}</p>
</div>`;
  return shell({ title: title(raw("navData")), path: "data/", body, collections });
}

export function csvRows(items) {
  const cols = ["id", "ark", "session", "title", "language", "languageISO", "dialect", "people", "recordingPlace", "date", "recordist", "fileType", "duration", "license", "subtitles"];
  const q = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const rows = items.map((it) => {
    const tm = it.tome;
    return [it.id, arkName(it.id), it.session.id, plain(tm.title), tm.language, isoOf(tm), tm.dialect, names((tm.interviewees || []).map((p) => p.fullName)), tm.recordingPlace, tm.date || tm.year, tm.recordist, tm.fileType, tm.duration, tm.license, it.subtitles.map((s) => s.language).join(" ")].map(q).join(",");
  });
  return [cols.join(","), ...rows].join("\n") + "\n";
}
