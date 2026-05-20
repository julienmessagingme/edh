import type { StepType } from "@/lib/dashboards/types";

export interface CampaignRef {
  id: string;
  position: number;
  step_type: StepType;
  event_ns: string | null;
  redirect_event_id: string | null;
  /** Renseigné uniquement en mode EDH pour les refs mm_event (event_ns non
   *  globalement unique entre écoles). NULL en mode école-précise. */
  event_school_slug: string | null;
}

export interface Campaign {
  id: string;
  school_slug: string;
  created_by: string;
  name: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignListItem extends Campaign {
  /** true ssi l'utilisateur courant est `created_by` ou admin. Une campagne
   *  partagée est visible par tous les users de l'école mais éditable
   *  uniquement par son auteur (ou un admin). */
  can_edit: boolean;
}

export interface CampaignWithRefs extends Campaign {
  can_edit: boolean;
  refs: CampaignRef[];
}
