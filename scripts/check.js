// Static checks run in CI (npm run check):
//   1. every project .js file parses (node --check)
//   2. every .ejs template compiles
// Catches syntax errors before anything is deployed.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "public"]);

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

let failures = 0;
const rel = f => path.relative(ROOT, f);

const jsFiles = [...walk(ROOT, ".js"), ...walk(path.join(ROOT, "public", "js"), ".js")];
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    failures++;
    console.error(`✗ JS syntax: ${rel(file)}\n${err.stderr.toString()}`);
  }
}

const templates = walk(path.join(ROOT, "views"), ".ejs");
for (const file of templates) {
  try {
    ejs.compile(fs.readFileSync(file, "utf8"), { filename: file });
  } catch (err) {
    failures++;
    console.error(`✗ EJS compile: ${rel(file)}\n${err.message}`);
  }
}

console.log(`Checked ${jsFiles.length} JS files and ${templates.length} EJS templates.`);
if (failures) {
  console.error(`${failures} file(s) failed.`);
  process.exit(1);
}
console.log("✓ All files OK");
