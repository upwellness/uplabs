import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

execSync(`npx esbuild src/main.jsx --bundle --minify --define:process.env.NODE_ENV='"production"' --outfile=.app.js`, { stdio: "inherit" });
execSync(`npx tailwindcss -c tailwind.config.js -i input.css -o .tw.css --minify`, { stdio: "inherit" });

const fonts = readFileSync("fonts-inline.css", "utf8");
const tw = readFileSync(".tw.css", "utf8");
const js = readFileSync(".app.js", "utf8");

const body = `<style>
${fonts}
${tw}
</style>
<div id="root" class="font-body"></div>
<script>${js}<\/script>`;

writeFileSync("health-lab.html", `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Health Lab · เช็กสุขภาพตัวเองแบบว้าว | Upwellness</title>
<meta name="description" content="เครื่องมือคัดกรองสุขภาพเบื้องต้นฟรี 5 อย่าง — เช็กสุขภาพ BMI, อายุหัวใจ, เสี่ยงเบาหวาน, อายุหู, ทดสอบสายตา">
</head>
<body>
${body}
</body>
</html>`);

writeFileSync("artifact.html", `<title>Health Lab · เช็กสุขภาพตัวเองแบบว้าว | Upwellness</title>
${body}`);

console.log("built health-lab.html", (readFileSync("health-lab.html").length / 1024).toFixed(0) + "KB");
