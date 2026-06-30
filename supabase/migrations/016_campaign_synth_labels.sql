-- 016_campaign_synth_labels.sql — Noms personnalisés des steps synthétiques
-- Apply via: Supabase SQL Editor → paste this whole file → Run.
--
-- Les steps « Lancement » et « Échec » d'un funnel de campagne sont
-- SYNTHÉTIQUES (générés à la volée par /api/dashboards/[id]/data à partir
-- des refs role='launch'/'failed'), ils ne vivent pas dans dashboard_steps
-- et n'avaient donc pas de label éditable comme les étapes normales.
--
-- On stocke leur nom personnalisé au niveau de la campagne. NULL = label
-- automatique (« Lancement : <events> » / « Échec : <events> »).

BEGIN;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS launch_label text,
  ADD COLUMN IF NOT EXISTS failed_label text;

COMMIT;
