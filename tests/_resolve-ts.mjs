/**
 * node:test resolver hook — lets pure lib modules keep their Next-style imports.
 *
 * Node's ESM loader wants explicit extensions and knows nothing about the `@/` alias;
 * Next/tsc accept both. Until now tested modules could only `import type` their
 * siblings. This hook maps `@/x` → <repo>/x and appends .ts/.tsx/.mts to extensionless
 * relative imports so an engine such as lib/health-design/assess.ts can call
 * lib/medical-status.ts at runtime in tests. Test-only; never loaded by Next.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function withExt(fsPath) {
  if (/\.[a-z]+$/i.test(fsPath) && existsSync(fsPath)) return fsPath;
  for (const e of EXTS) if (existsSync(fsPath + e)) return fsPath + e;
  for (const e of EXTS) if (existsSync(join(fsPath, "index" + e))) return join(fsPath, "index" + e);
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const p = withExt(join(ROOT, specifier.slice(2)));
    if (p) return next(pathToFileURL(p).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const p = withExt(fileURLToPath(new URL(specifier, context.parentURL)));
    if (p) return next(pathToFileURL(p).href, context);
  }
  return next(specifier, context);
}
