-- 015_campaign_multi_failed.sql — Plusieurs events FAILED par campagne
-- Apply via: Supabase SQL Editor → paste this whole file → Run.
--
-- Symétrique de la migration 014 (multi-launch). À partir de cette phase,
-- une campagne peut avoir PLUSIEURS events d'échec d'envoi (role='failed')
-- qui se CUMULENT : la somme de leurs counts est soustraite du lancement
-- pour calculer les envois réussis et le coût net Meta.
--
-- On lève donc la contrainte « au plus 1 failed par campagne » introduite
-- en migration 012, en supprimant l'index unique partiel correspondant.
-- Le role 'launch' est déjà multi (index supprimé en 014) ; 'body' n'a
-- jamais eu de limite.
--
-- Aucune donnée n'est modifiée : les campagnes existantes (0 ou 1 failed)
-- continuent à fonctionner à l'identique.

BEGIN;

DROP INDEX IF EXISTS campaign_refs_one_failed;

COMMIT;
