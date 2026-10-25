// Last-resort SVG → PNG for render_svg when neither rsvg-convert nor magick is installed (the usual case on
// Windows): open the SVG in the installed Chrome/Chromium/Edge with the puppeteer that mermaid-cli already ships.
// Usage: node svg-chrome.mjs <in.svg> <out.png> <browser executable>
import { readFileSync } from "node:fs"
import puppeteer from "puppeteer"

const [svgPath, outPath, executablePath] = process.argv.slice(2)
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 2000, height: 2000, deviceScaleFactor: 2 })
  await page.setContent(`<!doctype html><html><body style="margin:0;background:white">${readFileSync(svgPath, "utf8")}</body></html>`)
  const svg = await page.$("svg")
  if (!svg) throw new Error("The file has no <svg> element.")
  await svg.screenshot({ path: outPath })
} finally {
  await browser.close()
}
