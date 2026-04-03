#!/usr/bin/env node
/**
 * Déploie le dossier /site sur la branche gh-pages (GitHub Pages).
 * Prérequis : git installé, remote origin = ton repo GitHub, droits push.
 *
 * Usage :
 *   npm run deploy:pages
 *   npm run deploy:pages -- --dry-run
 *
 * Options env :
 *   PUBLIC_APP_URL=https://ton-app.vercel.app  → lien « Ouvrir l’app »
 *   GITHUB_REPO=https://github.com/user/repo.git  → override du remote
 *   GIT_USER_NAME / GIT_USER_EMAIL  → auteur du commit gh-pages (optionnel)
 *
 * Auth : HTTPS + PAT, ou SSH (remote git@github.com:...), ou gh auth login
 */

import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ghpages from "gh-pages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const siteDir = join(root, "site");
const configPath = join(siteDir, "config.js");

const PLACEHOLDER = "__APP_URL__PLACEHOLDER__";
/** Sans PUBLIC_APP_URL : éviter une URL Vercel inventée (404 DEPLOYMENT_NOT_FOUND). */
const DEFAULT_APP_URL = "https://vercel.com/dashboard";

const dryRun = process.argv.includes("--dry-run");

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
}

function getRepoUrl() {
  if (process.env.GITHUB_REPO?.trim()) {
    return process.env.GITHUB_REPO.trim();
  }
  try {
    return run("git remote get-url origin", { cwd: root });
  } catch {
    return null;
  }
}

async function patchConfigUrl(url) {
  const original = await readFile(configPath, "utf8");
  if (!original.includes(PLACEHOLDER)) {
    console.warn(
      "[deploy:pages] Placeholder absent de site/config.js — lien app non injecté."
    );
    return null;
  }
  const next = original.split(PLACEHOLDER).join(url);
  await writeFile(configPath, next, "utf8");
  return original;
}

async function main() {
  const repo = getRepoUrl();
  if (!repo) {
    console.error(
      "Configure le remote Git : git remote add origin https://github.com/tony2metagora/5Whygame.git\n" +
        "ou définis GITHUB_REPO=https://github.com/user/repo.git"
    );
    process.exit(1);
  }

  const appUrl = (process.env.PUBLIC_APP_URL || DEFAULT_APP_URL).trim();

  console.log("[deploy:pages] Remote :", repo);
  console.log("[deploy:pages] PUBLIC_APP_URL →", appUrl);

  let restore = null;
  try {
    restore = await patchConfigUrl(appUrl);

    const opts = {
      branch: "gh-pages",
      repo,
      message: `Deploy GitHub Pages ${new Date().toISOString().slice(0, 10)}`,
      dotfiles: true,
      user:
        process.env.GIT_USER_NAME && process.env.GIT_USER_EMAIL
          ? {
              name: process.env.GIT_USER_NAME,
              email: process.env.GIT_USER_EMAIL,
            }
          : undefined,
    };

    if (dryRun) {
      console.log("[deploy:pages] --dry-run : pas de push.");
      return;
    }

    await new Promise((resolve, reject) => {
      ghpages.publish(siteDir, opts, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log("[deploy:pages] OK — branche gh-pages mise à jour.");
    console.log(
      "[deploy:pages] GitHub : Settings → Pages → Source = branche gh-pages / racine."
    );
  } finally {
    if (restore) {
      await writeFile(configPath, restore, "utf8");
    }
  }
}

main().catch((e) => {
  console.error("[deploy:pages]", e);
  process.exit(1);
});
