import { validatePerfumeProduct } from "@/lib/validate-perfume";
import { buildRealtimeClientInstructions } from "@/lib/prompts/realtime-client";
import { azureCreateRealtimeClientSecret } from "@/lib/azure";

export const maxDuration = 60;

type Body = {
  instructions?: string;
  situation?: string;
  perfume?: unknown;
  prebrief?: string;
  difficulty?: string;
  voice?: string;
};

/**
 * Crée une session Realtime Azure.
 * Soit `instructions` (texte complet), soit `situation` + `perfume` (+ optional prebrief).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  let instructions = typeof body.instructions === "string" ? body.instructions : "";

  if (!instructions.trim()) {
    const validated = validatePerfumeProduct(body.perfume);
    if (!validated.ok) {
      return Response.json(
        { error: "Fiche produit invalide ou instructions manquantes.", details: validated.errors },
        { status: 400 }
      );
    }
    const situation = typeof body.situation === "string" ? body.situation : "";
    instructions = buildRealtimeClientInstructions({
      situation,
      perfume: validated.data,
      prebrief: typeof body.prebrief === "string" ? body.prebrief : undefined,
      difficulty:
        typeof body.difficulty === "string" ? body.difficulty : undefined,
    });
  }

  try {
    const { raw, ephemeralToken } = await azureCreateRealtimeClientSecret({
      instructions,
      voice: typeof body.voice === "string" ? body.voice : undefined,
    });
    return Response.json({
      instructions,
      ephemeralToken,
      session: raw,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return Response.json({ error: message }, { status: 502 });
  }
}
