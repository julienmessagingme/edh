export type StepType = "mm_event" | "url_click";
export type DatePreset = "7d" | "30d" | "90d" | "custom";
export type DashboardType = "funnel";

export interface StepRef {
  id: string;
  ref_position: number;
  step_type: StepType;
  event_ns: string | null;
  redirect_event_id: string | null;
}

export interface DashboardStep {
  id: string;
  position: number;
  /** NULL = auto-calculé "A + B + C" côté UI à partir des refs. */
  label: string | null;
  refs: StepRef[];
}

export interface Dashboard {
  id: string;
  school_slug: string;
  created_by: string;
  name: string;
  type: DashboardType;
  date_preset: DatePreset;
  date_from: string | null;
  date_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardWithSteps extends Dashboard {
  steps: DashboardStep[];
}

export interface ComputedRef {
  step_type: StepType;
  ref_id: string;
  label: string;
  count: number;
  available: boolean;
}

export interface ComputedStep {
  position: number;
  /** Résolu côté API : label stocké si présent, sinon "A + B + C". */
  label: string;
  /** Somme des `count` des refs `available`. */
  count: number;
  /** false ssi toutes les refs sont unavailable (ou si refs est vide). */
  available: boolean;
  refs: ComputedRef[];
}

export interface ComputedDashboardData {
  from: string;
  to: string;
  steps: ComputedStep[];
}

export interface PaletteItem {
  step_type: StepType;
  ref_id: string;
  label: string;
}

export interface Palette {
  mmEvents: PaletteItem[];
  redirectEvents: PaletteItem[];
}
