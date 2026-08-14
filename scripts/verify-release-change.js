const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fileAt(reference, file) {
  try {
    return git(["show", `${reference}:${file}`]);
  } catch {
    return null;
  }
}

function resolveBase() {
  const requested = process.env.RELEASE_GUARD_BASE || process.argv[2];
  if (requested && !/^0+$/.test(requested)) {
    try {
      git(["cat-file", "-e", `${requested}^{commit}`]);
      return requested;
    } catch {}
  }
  try {
    return git(["rev-parse", "HEAD^"]);
  } catch {
    return null;
  }
}

const base = resolveBase();
if (!base) {
  console.log("Release guard: aucun commit de base.");
} else {
  const changed = git(["diff", "--name-only", `${base}..HEAD`]).split("\n").filter(Boolean);
  const relevant = changed.filter((file) =>
    !/^(?:docs\/|test\/|scripts\/(?:test|verify)|\.github\/|README\.md$|CHANGELOG\.md$|package(?:-lock)?\.json$)/.test(file),
  );
  if (!relevant.length) {
    console.log("Release guard: changements docs/tests/CI uniquement, aucune release requise.");
  } else {
    const before = JSON.parse(fileAt(base, "package.json"));
    const after = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
    const errors = [];
    if (before.version === after.version) errors.push("package.json doit être incrémenté");
    if (fileAt(base, "CHANGELOG.md") === changelog.trim()) errors.push("CHANGELOG.md doit décrire la release");
    if (!new RegExp(`^## ${after.version.replaceAll(".", "\\.")} - `, "m").test(changelog))
      errors.push(`CHANGELOG.md doit contenir ${after.version}`);
    if (errors.length) throw new Error(`Release guard:\n- ${errors.join("\n- ")}`);
    console.log(`Release guard: ${relevant.length} fichier(s) produit couvert(s) par ${after.version}.`);
  }
}
