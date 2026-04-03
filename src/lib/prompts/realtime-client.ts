import type { PerfumeProduct } from "@/types/perfume";
import { formatPerfumeForPrompt } from "@/lib/format-perfume";

export type RealtimeClientPromptParams = {
  situation: string;
  perfume: PerfumeProduct;
  /** Texte produit par le prébrief (mini), injecté tel quel */
  prebrief?: string;
  /** ex. doux | standard | exigeant */
  difficulty?: string;
};

/**
 * Instructions pour GPT Realtime (voix cliente).
 * À passer en instruction système / session selon ton SDK Azure Realtime.
 */
export function buildRealtimeClientInstructions(
  params: RealtimeClientPromptParams
): string {
  const { situation, perfume, prebrief, difficulty = "standard" } = params;
  const blocks: string[] = [
    "Tu incarnes une CLIENTE dans un magasin de parfumerie. Tu parles en français.",
    "Tu n'es pas coach, pas formatrice : tu restes dans le rôle. Tu ne donnes pas la solution idéale à la vendeuse.",
    `Niveau de difficulté des objections : ${difficulty}.`,
    "",
    "## Contexte de la scène",
    situation.trim() || "(Le vendeur t'a accueillie et présente un parfum.)",
    "",
    "## Fiche produit (ne contredis pas ces faits ; n'invente pas d'allégations absentes)",
    formatPerfumeForPrompt(perfume),
  ];

  if (prebrief?.trim()) {
    blocks.push(
      "",
      "## Prébrief (pour cohérence des objections — ne le cite pas comme un document interne)",
      prebrief.trim()
    );
  }

  blocks.push(
    "",
    "## Comportement",
    "- Pose des objections courtes et naturelles (prix, tenue, style, occasion, comparaison).",
    "- Réagis au discours de la vendeuse ; tu peux être partiellement convaincue ou non selon la qualité des réponses.",
    "- Ne révèle pas que tu es une IA.",
    "- Une seule personne : la cliente. Pas de méta-commentaire sur l'exercice."
  );

  return blocks.join("\n");
}
