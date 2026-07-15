/**
 * Helpers de calcul de périodes, partagés entre la modale de comparaison
 * d'un tableau (`period-compare-dialog.tsx`) et le rapport Global
 * (`global-client.tsx`). Un seul endroit pour la règle "pas de chevauchement
 * de jour" et la définition des trimestres calendaires.
 */

export type Range = { from: string; to: string };

/** Date locale → chaîne ISO `YYYY-MM-DD` (jour seulement). */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fenêtre glissante des N derniers jours : [J−N → J]. */
export function lastNDays(n: number): Range {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - n);
  return { from: isoDate(from), to: isoDate(now) };
}

/**
 * 2 derniers mois glissants, SANS chevauchement de jour : A = [J−1 mois → J],
 * B = [J−2 mois → veille de J−1 mois]. Ex. le 15/07 : A = 15/06→15/07,
 * B = 15/05→14/06 (le 15/06 n'est compté qu'une fois, côté A).
 */
export function computeMonths(): { A: Range; B: Range } {
  const now = new Date();
  const aFrom = new Date(now);
  aFrom.setMonth(aFrom.getMonth() - 1);
  const bFrom = new Date(aFrom);
  bFrom.setMonth(bFrom.getMonth() - 1);
  const bTo = new Date(aFrom);
  bTo.setDate(bTo.getDate() - 1); // veille du début de A
  return {
    A: { from: isoDate(aFrom), to: isoDate(now) },
    B: { from: isoDate(bFrom), to: isoDate(bTo) },
  };
}

/**
 * Derniers trimestres calendaires : A = trimestre en cours (début → aujourd'hui),
 * B = trimestre précédent complet.
 */
export function computeQuarters(): { A: Range; B: Range } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3); // 0..3
  const qStart = new Date(now.getFullYear(), q * 3, 1);
  const bStart = new Date(now.getFullYear(), q * 3 - 3, 1); // roll year si négatif
  const bEnd = new Date(qStart);
  bEnd.setDate(bEnd.getDate() - 1); // veille du début du trimestre courant
  return {
    A: { from: isoDate(qStart), to: isoDate(now) },
    B: { from: isoDate(bStart), to: isoDate(bEnd) },
  };
}
