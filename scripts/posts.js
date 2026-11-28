import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./config.js";

const POSTS = join(ROOT, "posts");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function inline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// paragraphs, ## and ### headings, lists, quotes, images, links and emphasis; enough for a post
export function markdown(text) {
  return text.replace(/\r/g, "").trim().split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    const h = /^(#{2,3}) (.*)/.exec(block);
    if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    if (lines.every((l) => /^> ?/.test(l))) return `<blockquote><p>${inline(lines.map((l) => l.replace(/^> ?/, "")).join(" "))}</p></blockquote>`;
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(block)) return `<figure>${inline(block)}</figure>`;
    return `<p>${inline(lines.join(" "))}</p>`;
  }).join("\n");
}

// posts/<slug>.md, with title, date, authors and summary at the top between --- lines
export function loadPosts() {
  if (!existsSync(POSTS)) return [];
  return readdirSync(POSTS).filter((f) => f.endsWith(".md")).map((f) => {
    const text = readFileSync(join(POSTS, f), "utf8");
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r/g, ""));
    if (!m) throw new Error(`posts/${f}: start with title, date and authors between --- lines`);
    const head = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s*/)).map(([k, ...v]) => [k.trim(), v.join(": ").trim()]));
    if (!head.title || !/^\d{4}-\d\d-\d\d$/.test(head.date || "")) throw new Error(`posts/${f}: needs a title and a date as YYYY-MM-DD`);
    return {
      slug: f.slice(0, -3),
      title: head.title,
      date: head.date,
      authors: (head.authors || "").split(",").map((a) => a.trim()).filter(Boolean),
      summary: head.summary || "",
      html: markdown(m[2]),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
