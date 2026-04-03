# 5Whygame

**Entraînement à la réponse aux objections** — simulation vocale avec une IA qui joue la **cliente**, à partir d’une **situation** et d’une **fiche produit** (parfum, JSON).

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)](https://vercel.com/)

## En bref

| | |
|---|---|
| **Objectif** | S’entraîner à lever les objections (prix, produit, usage) face à une cliente virtuelle en audio. |
| **Données** | Contexte rédigé par l’utilisateur + fiche parfum structurée (schéma JSON). |
| **IA** | Prébrief **GPT-5.4 mini** (Azure) → instructions pour **GPT Realtime** (ex. `gpt-realtime-1.5`) ; **Whisper** pour la voix. |
| **Hébergement** | Frontend + API routes sur **Vercel** ; modèles via **Azure OpenAI**. |

## Fonctionnalités

- Validation d’une **fiche produit** parfum (JSON Schema).
- **Prébrief** : objections plausibles, argumentaires prix / caractéristiques (sans inventer hors fiche).
- **Instructions Realtime** pour incarner la cliente (voix).
- **Jeton WebRTC** via `POST /openai/v1/realtime/client_secrets`.
- **Transcription** micro → Whisper.

## Démarrage rapide

```bash
git clone https://github.com/tony2metagora/5Whygame.git
cd 5Whygame
npm install
cp .env.example .env.local
# Renseigner AZURE_OPENAI_* dans .env.local
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Variables d’environnement

Copier [`.env.example`](.env.example) vers `.env.local`. Variables principales :

| Variable | Rôle |
|----------|------|
| `AZURE_OPENAI_ENDPOINT` | URL de la ressource (sans `/` final) |
| `AZURE_OPENAI_API_KEY` | Clé API |
| `AZURE_OPENAI_API_VERSION` | API version **chat** + **Whisper** (ex. `2024-10-21`) |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | Déploiement prébrief (ex. `gpt-5.4-mini`) |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | Déploiement Whisper |
| `AZURE_OPENAI_REALTIME_DEPLOYMENT` | Déploiement Realtime (ex. `gpt-realtime-1.5`) |
| `AZURE_OPENAI_REALTIME_API_KEY` | *(Optionnel)* Clé dédiée Realtime |
| `AZURE_OPENAI_REALTIME_VOICE` | *(Optionnel)* Voix sortante WebRTC (défaut `alloy`) |
| `AZURE_OPENAI_REALTIME_API_VERSION` | Surtout pour l’URL WebSocket preview (`/openai/realtime`) |

Ne jamais committer `.env.local`. En cas d’exposition d’une clé, la **régénérer** dans le portail Azure.

Détails Realtime WebRTC : [Microsoft Learn — Realtime WebRTC](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-webrtc).

## Schéma & données exemple

- Schéma : [`src/schemas/perfume-product.schema.json`](src/schemas/perfume-product.schema.json)
- Exemple : [`data/perfume-example.json`](data/perfume-example.json) — aussi servi en `/perfume-example.json`

## API (routes Next.js)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `POST` | `/api/perfume/validate` | Valide le JSON fiche parfum |
| `POST` | `/api/prebrief` | `{ situation, perfume, difficulty? }` → prébrief + `realtimeInstructions` |
| `POST` | `/api/transcribe` | `multipart/form-data`, champ `file` → Whisper |
| `POST` | `/api/realtime/session` | `instructions` ou `situation` + `perfume` → `ephemeralToken` + `session` |

Le contexte de simulation reste côté client (MVP), sans base de données serveur.

## Scripts

```bash
npm run dev      # développement
npm run build    # build production
npm run start    # serveur après build
npm run lint
npm run benchmark # latence indicative chat mini (nécessite .env.local)
npm run deploy:pages      # déploie site/ → branche gh-pages (GitHub Pages)
npm run deploy:pages:dry  # test sans push
```

### GitHub Pages (`site/`)

L’app Next (API) reste sur **Vercel**. Le dossier [`site/`](site/) est une **landing statique** servie par GitHub Pages.

**Option A — automatique (recommandé)** : pousse sur `main` ; le workflow [`.github/workflows/github-pages.yml`](.github/workflows/github-pages.yml) publie `site/` sur la branche `gh-pages`. Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → Variables** : variable `PUBLIC_APP_URL` = URL Vercel (ex. `https://5whygame.vercel.app`). Sinon la valeur par défaut du workflow est utilisée.

**Option B — CLI en local** :

```powershell
# PowerShell (Windows) — remote si besoin
$env:GITHUB_REPO="https://github.com/tony2metagora/5Whygame.git"
$env:PUBLIC_APP_URL="https://ton-app.vercel.app"
npm run deploy:pages
```

Il faut un `git remote add origin …` pointant vers ton repo, ou `GITHUB_REPO` comme ci-dessus. Authentification : **SSH** (`git@github.com:…`) ou **HTTPS** avec un PAT.

**Activation** : **Settings → Pages** : source = branche **`gh-pages`**, dossier **`/ (root)`**.

## Déploiement

1. Repo GitHub : `tony2metagora/5Whygame` (ou nom de ton choix).
2. Importer le projet dans **Vercel**, renseigner les variables d’environnement (même contenu que `.env.local`).
3. Déployer la branche `main` (ou `master`).

## Licence

Projet privé / usage interne — ajuster selon ton choix.

---

**5Whygame** — *pour creuser les objections jusqu’à la cause racine du « non ».*
