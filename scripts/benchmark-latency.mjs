/**
 * Mesure indicative de latence (chat completions Azure — déploiement mini).
 * Usage : renseigner .env.local ou exporter les variables, puis `npm run benchmark`
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion =
  process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;

if (!endpoint || !apiKey || !deployment) {
  console.error(
    "Manque AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY ou AZURE_OPENAI_CHAT_DEPLOYMENT (.env.local)."
  );
  process.exit(1);
}

const url = `${endpoint}/openai/deployments/${encodeURIComponent(
  deployment
)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

const body = {
  messages: [
    {
      role: "user",
      content:
        "Réponds en une phrase : quel est le rôle d'un bref test de latence API ?",
    },
  ],
  max_completion_tokens: 80,
  temperature: 0.2,
};

const runs = 5;
const times = [];

async function one() {
  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const t1 = performance.now();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  await res.json();
  return t1 - t0;
}

async function main() {
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Déploiement chat: ${deployment}`);
  console.log(`Runs: ${runs}\n`);

  for (let i = 0; i < runs; i++) {
    try {
      const ms = await one();
      times.push(ms);
      console.log(`  Run ${i + 1}: ${ms.toFixed(0)} ms`);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }

  times.sort((a, b) => a - b);
  const mid = times[Math.floor(times.length / 2)];
  console.log(`\nLatence médiane (~round-trip): ${mid.toFixed(0)} ms`);
}

main();
