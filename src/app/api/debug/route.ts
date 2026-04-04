/**
 * Route diagnostic : vérifie la config Azure **sans exposer les secrets**.
 * Appeler GET /api/debug pour voir ce qui est branché.
 */
export async function GET() {
  const mask = (v: string | undefined) => {
    if (!v) return "(vide)";
    const t = v.trim();
    if (t.length <= 8) return `${t.slice(0, 2)}***`;
    return `${t.slice(0, 4)}…${t.slice(-4)} (${t.length} car.)`;
  };

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const realtimeApiKey = process.env.AZURE_OPENAI_REALTIME_API_KEY?.trim();
  const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim();
  const realtimeDeployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();

  const sameKey =
    apiKey && realtimeApiKey ? apiKey === realtimeApiKey : undefined;

  const chatUrl =
    endpoint && chatDeployment && apiVersion
      ? `${endpoint}/openai/deployments/${chatDeployment}/chat/completions?api-version=${apiVersion}`
      : "(incomplet)";

  const responsesVer =
    process.env.AZURE_OPENAI_RESPONSES_API_VERSION?.trim() ??
    "2025-04-01-preview";
  const responsesUrl = endpoint
    ? `${endpoint}/openai/responses?api-version=${responsesVer}`
    : "(incomplet)";
  const chatApiMode =
    process.env.AZURE_OPENAI_CHAT_API?.trim() || "auto (chat puis Responses si 404)";

  return Response.json({
    endpoint: endpoint ?? "(vide)",
    apiKey: mask(apiKey),
    realtimeApiKey: mask(realtimeApiKey),
    sameKeyForBoth: sameKey,
    chatDeployment: chatDeployment ?? "(vide)",
    realtimeDeployment: realtimeDeployment ?? "(vide)",
    apiVersion: apiVersion ?? "(non défini → défaut 2024-12-01-preview)",
    realtimeApiVersion: process.env.AZURE_OPENAI_REALTIME_API_VERSION?.trim() ?? "(non défini)",
    realtimeVoice: process.env.AZURE_OPENAI_REALTIME_VOICE?.trim() ?? "(non défini → défaut alloy)",
    chatUrlConstructed: chatUrl,
    responsesUrlConstructed: responsesUrl,
    AZURE_OPENAI_CHAT_API: chatApiMode,
    AZURE_OPENAI_RESPONSES_API_VERSION: responsesVer,
  });
}
