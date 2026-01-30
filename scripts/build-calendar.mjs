import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const src = "node_modules/@schedule-x/theme-default/dist/index.css";
const dest = "app/static/schedule-x.css";

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log("Wrote", dest);
