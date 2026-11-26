import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const DATA_DIR = join(ROOT, "data");
export const OUT_DIR = join(ROOT, "dist");
export const STATIC_DIR = join(ROOT, "static");

export const SITE_NAME = "OpenSpeaks Archives";
export const PUBLISHER = "O Foundation";
export const SITE_URL = (process.env.SITE_URL || "http://127.0.0.1:8765/").replace(/\/?$/, "/");
export const BASE = new URL(SITE_URL).pathname;

// ids stay drafts until theofdn.org forwards ark:15056/osa-* here
export const ARK_NAAN = "15056";
export const ARK_SHOULDER = "osa-";
export const arkName = (id) => `ark:${ARK_NAAN}/${ARK_SHOULDER}${id}`;
export const arkUrl = (id) => `https://n2t.net/${arkName(id)}`;
