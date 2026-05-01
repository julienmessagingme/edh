-- 005_dashboard_step_refs.sql — Multi-refs par step (cumul)
-- Apply via: Supabase SQL Editor → paste this whole file → Run.
--
-- Restructure dashboard_steps : un step n'a plus une seule ref (event_ns OU
-- redirect_event_id) mais une LISTE de refs stockées dans une sous-table
-- dashboard_step_refs. Le volume du step = somme des volumes de ses refs.
--
-- Migration destructive : suppose qu'il n'existe encore aucun dashboard_step
-- en prod (le module a été livré le 2026-05-01 sans utilisation préalable).
-- Le garde-fou ci-dessous lèvera une erreur claire sinon. Si tu en as déjà
-- créé, dis-le et on fait une migration data-preserving.

-- Garde-fou : refuser la migration si des steps existent déjà.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM dashboard_steps LIMIT 1) THEN
    RAISE EXCEPTION 'Migration 005 destructive : des dashboard_steps existent déjà. Arrête et adapte la migration pour préserver les données.';
  END IF;
END $$;

BEGIN;

-- 1. Drop des colonnes/contraintes ref obsolètes sur dashboard_steps
ALTER TABLE dashboard_steps
  DROP CONSTRAINT IF EXISTS dashboard_steps_one_ref;
ALTER TABLE dashboard_steps DROP COLUMN IF EXISTS step_type;
ALTER TABLE dashboard_steps DROP COLUMN IF EXISTS event_ns;
ALTER TABLE dashboard_steps DROP COLUMN IF EXISTS redirect_event_id;

-- 2. Nouveau label optionnel (NULL = label auto-calculé "A + B + C" côté front)
ALTER TABLE dashboard_steps
  ADD COLUMN IF NOT EXISTS label text;

-- 3. Sous-table refs : un step peut avoir N refs, sommées au calcul.
CREATE TABLE IF NOT EXISTS dashboard_step_refs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id           uuid NOT NULL REFERENCES dashboard_steps(id) ON DELETE CASCADE,
  ref_position      int  NOT NULL,
  step_type         text NOT NULL CHECK (step_type IN ('mm_event','url_click')),
  event_ns          text,
  redirect_event_id uuid REFERENCES redirect_events(id) ON DELETE CASCADE,
  CONSTRAINT dashboard_step_refs_one_ref CHECK (
    (step_type = 'mm_event'  AND event_ns IS NOT NULL AND redirect_event_id IS NULL)
 OR (step_type = 'url_click' AND event_ns IS NULL    AND redirect_event_id IS NOT NULL)
  ),
  UNIQUE (step_id, ref_position)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_step_refs_step
  ON dashboard_step_refs (step_id, ref_position);

COMMIT;
