import { validatePerfumeProduct } from "@/lib/validate-perfume";
import {
  PREBRIEF_SYSTEM_PROMPT,
  buildPrebriefUserMessage,
} from "@/lib/prompts/prebrief-mini";
import { buildRealtimeClientInstructions } from "@/lib/prompts/realtime-client";
import { azureChatCompletion } from "@/lib/azure";

export const maxDuration = 120;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = body as {
    situation?: string;
    perfume?: unknown;
    difficulty?: string;
  };

  const validated = validatePerfumeProduct(parsed.perfume);
  if (!validated.ok) {
    return Response.json(
      { error: "Fiche produit invalide.", details: validated.errors },
      { status: 400 }
    );
  }

  const situation = typeof parsed.situation === "string" ? parsed.situation : "";
  const difficulty =
    typeof parsed.difficulty === "string" ? parsed.difficulty : undefined;

  try {
    const prebrief = await azureChatCompletion({
      messages: [
        { role: "system", content: PREBRIEF_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildPrebriefUserMessage(situation, validated.data),
        },
      ],
      maxCompletionTokens: 2500,
    });

    const realtimeInstructions = buildRealtimeClientInstructions({
      situation,
      perfume: validated.data,
      prebrief,
      difficulty,
    });

    return Response.json({
      prebrief,
      realtimeInstructions,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return Response.json({ error: message }, { status: 502 });
  }
}
