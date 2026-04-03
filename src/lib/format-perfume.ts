import type { PerfumeProduct } from "@/types/perfume";

/** Sérialise la fiche pour prompts (lisible par un modèle). */
export function formatPerfumeForPrompt(perfume: PerfumeProduct): string {
  return JSON.stringify(perfume, null, 2);
}
