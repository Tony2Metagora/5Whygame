/** Appels Azure OpenAI (Whisper, chat mini, session Realtime). */

export type AzureEnv = {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
};

export function getAzureOpenAIEnv(): AzureEnv {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "").trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION?.trim() ?? "2024-12-01-preview";
  if (!endpoint || !apiKey) {
    throw new Error(
      "Configuration Azure manquante : AZURE_OPENAI_ENDPOINT et AZURE_OPENAI_API_KEY sont requis."
    );
  }
  return { endpoint, apiKey, apiVersion };
}

/** Clé dédiée Realtime (optionnelle) si différente du reste de la ressource. */
function getRealtimeApiKey(): string {
  return (
    process.env.AZURE_OPENAI_REALTIME_API_KEY?.trim() ||
    process.env.AZURE_OPENAI_API_KEY?.trim() ||
    ""
  );
}

export async function azureChatCompletion(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxCompletionTokens?: number;
}): Promise<string> {
  const { endpoint, apiKey, apiVersion } = getAzureOpenAIEnv();
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim();
  if (!deployment) {
    throw new Error(
      "AZURE_OPENAI_CHAT_DEPLOYMENT est requis (ex. gpt-5.4-nano, nom exact du déploiement Azure)."
    );
  }
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(
    deployment
  )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const body: Record<string, unknown> = {
    messages: params.messages,
    temperature: params.temperature ?? 0.6,
    max_completion_tokens: params.maxCompletionTokens ?? 2000,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure chat completions ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

/** Extrait le texte d’une réponse API « Responses » (Foundry). */
function extractResponsesOutputText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const root = data as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text.trim()) {
    return root.output_text;
  }
  const output = root.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as { type?: string; text?: string };
      if (p.type === "output_text" && typeof p.text === "string") {
        chunks.push(p.text);
      }
    }
  }
  return chunks.join("\n");
}

/**
 * API **Responses** (nano / Foundry) — chemin portail : `/openai/responses?api-version=2025-04-01-preview`.
 * À utiliser quand `.../chat/completions` renvoie 404 (déploiement non exposé en chat).
 */
export async function azureResponsesCompletion(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxOutputTokens?: number;
}): Promise<string> {
  const { endpoint, apiKey } = getAzureOpenAIEnv();
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim();
  if (!deployment) {
    throw new Error("AZURE_OPENAI_CHAT_DEPLOYMENT est requis.");
  }
  const apiVersion =
    process.env.AZURE_OPENAI_RESPONSES_API_VERSION?.trim() ??
    "2025-04-01-preview";

  const url = `${endpoint}/openai/responses?api-version=${encodeURIComponent(
    apiVersion
  )}`;

  const input = params.messages.map((m) => ({
    type: "message" as const,
    role: m.role,
    content: m.content,
  }));

  const body: Record<string, unknown> = {
    model: deployment,
    input,
    max_output_tokens: params.maxOutputTokens ?? 2500,
  };

  let res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  let text = await res.text();

  if (!res.ok && res.status === 400) {
    const merged = params.messages
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n\n");
    const fallbackBody: Record<string, unknown> = {
      model: deployment,
      input: [
        {
          type: "message",
          role: "user",
          content: merged,
        },
      ],
      max_output_tokens: params.maxOutputTokens ?? 2500,
    };
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(fallbackBody),
    });
    text = await res.text();
  }

  if (!res.ok) {
    throw new Error(`Azure responses ${res.status}: ${text}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Réponse Responses non JSON.");
  }

  return extractResponsesOutputText(json);
}

/**
 * Prébrief : **chat completions** ou **Responses** selon `AZURE_OPENAI_CHAT_API`.
 * - `chat` : uniquement chat completions
 * - `responses` : uniquement Responses (nano côté portail)
 * - `auto` (défaut) : essaie chat, puis Responses si 404 / Resource not found
 */
export async function azureCompletionForPrebrief(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxCompletionTokens?: number;
}): Promise<string> {
  const mode =
    process.env.AZURE_OPENAI_CHAT_API?.trim().toLowerCase() ?? "auto";

  if (mode === "responses") {
    return azureResponsesCompletion({
      messages: params.messages,
      maxOutputTokens: params.maxCompletionTokens,
    });
  }

  if (mode === "chat") {
    return azureChatCompletion(params);
  }

  try {
    return await azureChatCompletion(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/404|resource not found/i.test(msg)) {
      return azureResponsesCompletion({
        messages: params.messages,
        maxOutputTokens: params.maxCompletionTokens,
      });
    }
    throw e;
  }
}

/**
 * Transcription audio via déploiement Whisper sur Azure.
 * Le champ fichier attendu dans le FormData entrant est `file`.
 */
export async function azureTranscribeFormData(formData: FormData): Promise<{
  text: string;
}> {
  const { endpoint, apiKey, apiVersion } = getAzureOpenAIEnv();
  const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT;
  if (!deployment) {
    throw new Error("AZURE_OPENAI_WHISPER_DEPLOYMENT est requis.");
  }
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(
    deployment
  )}/audio/transcriptions?api-version=${encodeURIComponent(apiVersion)}`;

  const outbound = new FormData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    throw new Error("Champ « file » manquant ou invalide.");
  }
  const name =
    (typeof (file as File).name === "string" && (file as File).name) ||
    "audio.webm";
  outbound.append("file", file, name);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
    },
    body: outbound,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure Whisper ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { text?: string };
  return { text: json.text ?? "" };
}

export type AzureRealtimeClientSecretResult = {
  /** Réponse brute Azure (souvent contient `value` = jeton éphémère WebRTC). */
  raw: unknown;
  /** Jeton éphémère pour `Authorization: Bearer` côté navigateur (WebRTC). */
  ephemeralToken?: string;
};

/**
 * GA WebRTC : demande un jeton éphémère via `POST /openai/v1/realtime/client_secrets`.
 * @see https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-webrtc
 */
export async function azureCreateRealtimeClientSecret(params: {
  instructions?: string;
  voice?: string;
}): Promise<AzureRealtimeClientSecretResult> {
  const { endpoint } = getAzureOpenAIEnv();
  const apiKey = getRealtimeApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé Realtime manquante : AZURE_OPENAI_REALTIME_API_KEY ou AZURE_OPENAI_API_KEY."
    );
  }

  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  if (!deployment) {
    throw new Error("AZURE_OPENAI_REALTIME_DEPLOYMENT est requis (ex. gpt-realtime-1.5).");
  }

  const voice =
    params.voice ??
    process.env.AZURE_OPENAI_REALTIME_VOICE?.trim() ??
    "alloy";

  const url = `${endpoint}/openai/v1/realtime/client_secrets`;

  const body = {
    session: {
      type: "realtime",
      model: deployment,
      ...(params.instructions?.trim()
        ? { instructions: params.instructions.trim() }
        : {}),
      audio: {
        output: {
          voice,
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Azure Realtime client_secrets ${res.status}: ${text}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Réponse client_secrets non JSON.");
  }

  const ephemeralToken =
    typeof raw === "object" &&
    raw !== null &&
    "value" in raw &&
    typeof (raw as { value: unknown }).value === "string"
      ? (raw as { value: string }).value
      : undefined;

  return { raw, ephemeralToken };
}

/**
 * URL WebSocket **preview** (`/openai/realtime`) pour usage serveur-à-serveur ou outillage.
 * Auth : en-tête `api-key` (non disponible dans le navigateur) ou paramètre `api-key` sur l’URL WSS.
 */
export function buildAzureRealtimePreviewWebSocketUrl(): string {
  const { endpoint } = getAzureOpenAIEnv();
  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  if (!deployment) {
    throw new Error("AZURE_OPENAI_REALTIME_DEPLOYMENT est requis.");
  }
  const apiVersion =
    process.env.AZURE_OPENAI_REALTIME_API_VERSION ?? "2024-10-01-preview";
  const host = endpoint.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
  const q = new URLSearchParams({
    "api-version": apiVersion,
    deployment,
  });
  return `${host}/openai/realtime?${q.toString()}`;
}

/** @deprecated Utiliser `azureCreateRealtimeClientSecret` (WebRTC GA). */
export async function azureCreateRealtimeSession(params: {
  instructions?: string;
  voice?: string;
}): Promise<unknown> {
  const { raw } = await azureCreateRealtimeClientSecret(params);
  return raw;
}
