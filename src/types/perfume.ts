/** Données alignées sur `src/schemas/perfume-product.schema.json` */

export type NotesField = string | string[];

export interface PerfumeProduct {
  marque: string;
  ligne?: string;
  nom_du_parfum: string;
  annee_sortie?: number;
  prix_public_ttc: number;
  contenance_ml: number;
  prix_au_litre?: number;
  canal?: string;
  positionnement?: string;
  famille_olfactive_principale?: string;
  notes_de_tete?: NotesField;
  notes_de_coeur?: NotesField;
  notes_de_fond?: NotesField;
  accords_cles?: string[];
  intensite?: string;
  sillage?: string;
  tenue?: string;
  concentration?: string;
  ingredients_mis_en_avant?: string;
  sans_alcool?: boolean;
  clean_beauty_claims?: string;
  histoire_maison?: string;
  nez_parfumeur?: string;
  inspiration_narrative?: string;
  codes_visuels?: string;
  promesse_emotionnelle?: string;
  persona_cible?: string;
  occasions_usage?: string;
  points_faibles_connus?: string;
  arguments_prix?: string;
  arguments_produit?: string;
}
