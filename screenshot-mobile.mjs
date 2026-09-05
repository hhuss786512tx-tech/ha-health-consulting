import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

const url = process.argv[2];
const label = process.argv[3] || "mobile";

const dir = "./temporary screenshots";
fs.mkdirSync(dir, { recursive: true });
const existing = fs
  .readdirSync(dir)
  .map((f) => f.match(/^screenshot-(\d+)/))
  .filter(Boolean)
  .map((m) => parseInt(m[1], 10));
const next = existing.length ? Math.max(...existing) + 1 : 1;
const outPath = path.join(dir, `screenshot-${next}-${label}.png`);

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.waitForFunction(
  () => {
    const s = document.getElementById("introSplash");
    return !s || s.classList.contains("is-removed");
  },
  { timeout: 3000 }
).catch(() => {});
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(`Saved ${outPath}`);
