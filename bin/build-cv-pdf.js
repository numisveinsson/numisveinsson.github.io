#!/usr/bin/env node
// Renders the /cv/print/ page of a built site to a PDF.
// Usage: CHROME_PATH=/path/to/chrome node bin/build-cv-pdf.js <site-dir> <output.pdf>
const fs = require("fs");
const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer-core");

const [siteDir, output] = process.argv.slice(2);
if (!siteDir || !output || !process.env.CHROME_PATH) {
  console.error("Usage: CHROME_PATH=/path/to/chrome node bin/build-cv-pdf.js <site-dir> <output.pdf>");
  process.exit(1);
}

const root = path.resolve(siteDir);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/cv/print/`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);

    // Stop the build rather than publish an empty or partial CV.
    const text = await page.evaluate(() => document.body.innerText);
    for (const expected of ["Research Experience", "Postdoctoral Fellow", "MeshGrow", "Presentations and Workshops"]) {
      if (!text.includes(expected)) {
        throw new Error(`CV is missing expected content: ${expected}`);
      }
    }

    const updated = new Date().toISOString().slice(0, 10);
    await page.pdf({
      path: output,
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="font-size:8px;width:100%;padding:0 0.9in;display:flex;justify-content:space-between;color:#555"><span>Updated ${updated}</span><span class="pageNumber"></span></div>`,
      margin: { top: "0.8in", bottom: "0.8in", left: "0.9in", right: "0.9in" },
    });
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
