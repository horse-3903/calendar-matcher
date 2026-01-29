import fs from "fs";
import path from "path";
import https from "https";

const root = process.cwd();
const sources = [
  {
    local: "node_modules/@fullcalendar/core/index.css",
    url: "https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.20/index.css"
  },
  {
    local: "node_modules/@fullcalendar/daygrid/index.css",
    url: "https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.20/index.css"
  },
  {
    local: "node_modules/@fullcalendar/timegrid/index.css",
    url: "https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.20/index.css"
  },
  {
    local: "node_modules/@fullcalendar/list/index.css",
    url: "https://cdn.jsdelivr.net/npm/@fullcalendar/list@6.1.20/index.css"
  }
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

const chunks = [];
for (const source of sources) {
  const localPath = path.join(root, source.local);
  if (fs.existsSync(localPath)) {
    chunks.push(fs.readFileSync(localPath, "utf8"));
  } else {
    chunks.push(await fetchUrl(source.url));
  }
}

const outPath = path.join(root, "app", "static", "fullcalendar.css");
fs.writeFileSync(outPath, chunks.join("\n"));
console.log(`Wrote ${outPath}`);
