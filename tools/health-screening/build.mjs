/**
 * Build public/health-screening-v1.html — a single self-contained HTML file
 * (React + Tailwind bundled, Thai fonts inlined as data URIs, works offline).
 *
 * Usage:  node tools/health-screening/build.mjs
 * Needs network access on first run to fetch Prompt/Anuphan from Google Fonts.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../public/health-screening-v1.html");
const fontsCache = join(here, "fonts-inline.css");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Prompt:wght@600;700&family=Anuphan:wght@400;600&display=swap";

async function buildFontsCss() {
  if (existsSync(fontsCache)) return readFileSync(fontsCache, "utf8");
  const css = await (await fetch(FONTS_URL, { headers: { "User-Agent": UA } })).text();
  // keep only the thai + latin subsets, inline each woff2 as a data URI
  const parts = css.split(/\/\* (\w[\w-]*) \*\//).slice(1);
  let inline = "";
  for (let i = 0; i < parts.length; i += 2) {
    const subset = parts[i];
    if (subset !== "thai" && subset !== "latin") continue;
    const block = parts[i + 1].trim();
    const url = block.match(/url\((.*?)\)/)[1];
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    inline +=
      block.replace(
        /url\(.*?\) format\('woff2'\)/,
        `url(data:font/woff2;base64,${buf.toString("base64")}) format("woff2")`
      ) + "\n";
  }
  writeFileSync(fontsCache, inline);
  return inline;
}

const fonts = await buildFontsCss();

execSync(
  `npx -y esbuild app.jsx --bundle --minify --define:process.env.NODE_ENV='"production"' --outfile=.build-app.js`,
  { cwd: here, stdio: "inherit" }
);
execSync(`npx tailwindcss -c tailwind.config.js -i input.css -o .build-tw.css --minify`, {
  cwd: here,
  stdio: "inherit",
});

const tw = readFileSync(join(here, ".build-tw.css"), "utf8");
const js = readFileSync(join(here, ".build-app.js"), "utf8");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>เช็กสุขภาพ 60 วินาที · Upwellness Health Lab</title>
<meta name="description" content="เครื่องมือเช็กสุขภาพเบื้องต้นฟรี — BMI เกณฑ์คนเอเชีย BMR TDEE โปรตีน น้ำ โซนหัวใจ">
</head>
<body>
<style>
${fonts}
${tw}
</style>
<div id="root" class="font-body"></div>
<script>${js}<\/script>
</body>
</html>`
);
console.log("wrote", out);
