import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const awardsDir = path.join(root, "public", "awards");
const outFile = path.join(root, "src", "generated", "awardArtworkManifest.ts");

const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function walk(dir, base = "") {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs, rel));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!allowed.has(ext)) continue;
    out.push(rel);
  }

  return out;
}

function titleFromFile(file) {
  return file
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const files = walk(awardsDir).sort((a, b) => a.localeCompare(b));
const lines = [
  "export type TrophyArtworkOption = {",
  "  label: string;",
  "  value: string;",
  "};",
  "",
  "export const TROPHY_ARTWORK_OPTIONS: TrophyArtworkOption[] = [",
  ...files.map((file) => {
    const rel = `/awards/${file.replace(/\\/g, "/")}`;
    return `  { label: ${JSON.stringify(titleFromFile(file))}, value: encodeURI(${JSON.stringify(rel)}) },`;
  }),
  "];",
  "",
];

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(`Generated ${path.relative(root, outFile)} from ${files.length} award artwork file(s).`);
