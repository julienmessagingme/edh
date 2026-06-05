-- 014_campaign_multi_launch.sql — Plusieurs events de LANCEMENT par campagne
-- Apply via: Supabase SQL Editor → paste this whole file → Run.
--
-- À partir de la Phase 28.x, une campagne peut avoir PLUSIEURS events de
-- lancement (role='launch') qui se CUMULENT (volumes + coûts Meta sommés).
-- On lève donc la contrainte « au plus 1 launch par campagne » introduite
-- en migration 012, en supprimant l'index unique partiel correspondant.
--
-- Le role 'failed' reste limité à 1 par campagne (index conservé) : un seul
-- event d'échec d'envoi a du sens pour le calcul du net.
--
-- Aucune donnée n'est modifiée : les campagnes existantes (0 ou 1 launch)
-- continuent à fonctionner à l'identique.

BEGIN;

DROP INDEX IF EXISTS campaign_refs_one_launch;

COMMIT;
