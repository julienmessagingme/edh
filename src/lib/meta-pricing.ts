/**
 * Tarifs Meta WhatsApp Business — catégorie MARKETING — par pays.
 *
 * Source : https://developers.facebook.com/docs/whatsapp/pricing
 * Valeurs constatées 2025/2026 pour un compte WABA EU (facturé en €).
 * Imprécision attendue : Meta révise les tarifs ~2× par an, à vérifier
 * périodiquement et corriger ici. Les valeurs sont en EUR par message
 * marketing envoyé (sortant initié par l'entreprise — fenêtre 24h
 * dépassée ou template marketing).
 *
 * Couverture : ~100 pays (Europe, TOUTE l'Afrique subsaharienne, Maghreb,
 * Moyen-Orient, Amériques, Asie). Depuis juillet 2025 Meta facture au
 * MESSAGE (et non plus à la conversation) selon l'indicatif du
 * destinataire, avec des tiers régionaux : l'Afrique subsaharienne forme
 * un tier « Rest of Africa » (~$0.0225/msg ≈ 0,021 €), ce qui rend
 * périmées les anciennes valeurs individuelles par pays africain. Les
 * montants ci-dessous sont convertis USD→EUR (×~0,93) d'après le rate card
 * 2025/2026 et restent une ESTIMATION : à caler sur la facture WABA réelle
 * d'EDH. Indicatif hors liste → fallback « Autre » (tier « Other » Meta).
 */

export interface PhoneCountry {
  /** Code ISO 3166 alpha-2. */
  iso: string;
  /** Nom court du pays/zone (français). */
  name: string;
  /** Tarif Meta marketing en EUR par message. */
  marketingEur: number;
}

/** Tarif fallback pour un numéro dont l'indicatif n'est pas reconnu, ou
 *  pour les pays absents du tableau ci-dessous. Calé sur le tier « Other »
 *  de Meta (~$0.0604/msg ≈ 0,055 €). */
const FALLBACK: PhoneCountry = {
  iso: "XX",
  name: "Autre / non reconnu",
  marketingEur: 0.055,
};

/**
 * Map indicatif téléphonique → pays. Ordonné dans la fonction
 * `extractCountry` du préfixe le plus long au plus court (ex: +1242
 * Bahamas avant +1 USA/Canada — pas implémenté ici, on simplifie +1 à
 * USA/Canada pour le MVP).
 *
 * Valeurs marketing EUR au 2026-05 (à raffiner avec la facturation Meta
 * réelle du compte WABA EDH).
 */
const PHONE_CODES: Record<string, PhoneCountry> = {
  // --- Europe de l'Ouest ---
  "33": { iso: "FR", name: "France", marketingEur: 0.0715 },
  "32": { iso: "BE", name: "Belgique", marketingEur: 0.0742 },
  "31": { iso: "NL", name: "Pays-Bas", marketingEur: 0.0817 },
  "49": { iso: "DE", name: "Allemagne", marketingEur: 0.0786 },
  "34": { iso: "ES", name: "Espagne", marketingEur: 0.0615 },
  "39": { iso: "IT", name: "Italie", marketingEur: 0.0535 },
  "351": { iso: "PT", name: "Portugal", marketingEur: 0.0561 },
  "41": { iso: "CH", name: "Suisse", marketingEur: 0.0727 },
  "43": { iso: "AT", name: "Autriche", marketingEur: 0.0699 },
  "44": { iso: "GB", name: "Royaume-Uni", marketingEur: 0.0445 },
  "353": { iso: "IE", name: "Irlande", marketingEur: 0.0571 },
  "352": { iso: "LU", name: "Luxembourg", marketingEur: 0.0712 },
  "45": { iso: "DK", name: "Danemark", marketingEur: 0.0512 },
  "46": { iso: "SE", name: "Suède", marketingEur: 0.0488 },
  "47": { iso: "NO", name: "Norvège", marketingEur: 0.0531 },
  "358": { iso: "FI", name: "Finlande", marketingEur: 0.0496 },
  "30": { iso: "GR", name: "Grèce", marketingEur: 0.0589 },
  "48": { iso: "PL", name: "Pologne", marketingEur: 0.0274 },
  "40": { iso: "RO", name: "Roumanie", marketingEur: 0.0286 },
  "420": { iso: "CZ", name: "Tchéquie", marketingEur: 0.0356 },
  // Europe centrale/de l'Est + Caucase (estimations, alignées sur les
  // tarifs EU-Est voisins ; Géorgie d'après le rate card ~$0.086).
  "359": { iso: "BG", name: "Bulgarie", marketingEur: 0.030 },
  "36": { iso: "HU", name: "Hongrie", marketingEur: 0.030 },
  "421": { iso: "SK", name: "Slovaquie", marketingEur: 0.030 },
  "386": { iso: "SI", name: "Slovénie", marketingEur: 0.040 },
  "385": { iso: "HR", name: "Croatie", marketingEur: 0.040 },
  "380": { iso: "UA", name: "Ukraine", marketingEur: 0.040 },
  "381": { iso: "RS", name: "Serbie", marketingEur: 0.040 },
  "370": { iso: "LT", name: "Lituanie", marketingEur: 0.040 },
  "371": { iso: "LV", name: "Lettonie", marketingEur: 0.040 },
  "372": { iso: "EE", name: "Estonie", marketingEur: 0.040 },
  "995": { iso: "GE", name: "Géorgie", marketingEur: 0.080 },

  // --- Amérique du Nord ---
  "1": { iso: "US", name: "USA / Canada", marketingEur: 0.0246 },

  // --- Amérique latine ---
  "52": { iso: "MX", name: "Mexique", marketingEur: 0.0423 },
  "55": { iso: "BR", name: "Brésil", marketingEur: 0.0235 },
  "54": { iso: "AR", name: "Argentine", marketingEur: 0.0566 },
  "56": { iso: "CL", name: "Chili", marketingEur: 0.0817 },
  "57": { iso: "CO", name: "Colombie", marketingEur: 0.0115 },
  "51": { iso: "PE", name: "Pérou", marketingEur: 0.0710 },

  // --- Maghreb ---
  "212": { iso: "MA", name: "Maroc", marketingEur: 0.0625 },
  "213": { iso: "DZ", name: "Algérie", marketingEur: 0.1050 },
  "216": { iso: "TN", name: "Tunisie", marketingEur: 0.0620 },

  // --- Afrique subsaharienne — tier « Rest of Africa » Meta (~$0.0225/msg
  //     ≈ 0,021 €). Réaligné sur le rate card per-message 2025/2026 ; les
  //     anciennes valeurs (Côte d'Ivoire 0,058 €, Cameroun 0,0379 €…)
  //     dataient du modèle conversation et étaient surévaluées. ---
  "221": { iso: "SN", name: "Sénégal", marketingEur: 0.021 },
  "225": { iso: "CI", name: "Côte d'Ivoire", marketingEur: 0.021 },
  "223": { iso: "ML", name: "Mali", marketingEur: 0.021 },
  "226": { iso: "BF", name: "Burkina Faso", marketingEur: 0.021 },
  "228": { iso: "TG", name: "Togo", marketingEur: 0.021 },
  "229": { iso: "BJ", name: "Bénin", marketingEur: 0.021 },
  "227": { iso: "NE", name: "Niger", marketingEur: 0.021 },
  "224": { iso: "GN", name: "Guinée", marketingEur: 0.021 },
  "245": { iso: "GW", name: "Guinée-Bissau", marketingEur: 0.021 },
  "222": { iso: "MR", name: "Mauritanie", marketingEur: 0.021 },
  "220": { iso: "GM", name: "Gambie", marketingEur: 0.021 },
  "231": { iso: "LR", name: "Liberia", marketingEur: 0.021 },
  "232": { iso: "SL", name: "Sierra Leone", marketingEur: 0.021 },
  "233": { iso: "GH", name: "Ghana", marketingEur: 0.021 },
  "238": { iso: "CV", name: "Cap-Vert", marketingEur: 0.021 },
  "237": { iso: "CM", name: "Cameroun", marketingEur: 0.021 },
  "241": { iso: "GA", name: "Gabon", marketingEur: 0.021 },
  "240": { iso: "GQ", name: "Guinée équatoriale", marketingEur: 0.021 },
  "236": { iso: "CF", name: "Centrafrique", marketingEur: 0.021 },
  "235": { iso: "TD", name: "Tchad", marketingEur: 0.021 },
  "242": { iso: "CG", name: "Congo-Brazzaville", marketingEur: 0.021 },
  "243": { iso: "CD", name: "RD Congo", marketingEur: 0.021 },
  "239": { iso: "ST", name: "Sao Tomé-et-Principe", marketingEur: 0.021 },
  "254": { iso: "KE", name: "Kenya", marketingEur: 0.021 },
  "255": { iso: "TZ", name: "Tanzanie", marketingEur: 0.021 },
  "256": { iso: "UG", name: "Ouganda", marketingEur: 0.021 },
  "250": { iso: "RW", name: "Rwanda", marketingEur: 0.021 },
  "257": { iso: "BI", name: "Burundi", marketingEur: 0.021 },
  "251": { iso: "ET", name: "Éthiopie", marketingEur: 0.021 },
  "252": { iso: "SO", name: "Somalie", marketingEur: 0.021 },
  "253": { iso: "DJ", name: "Djibouti", marketingEur: 0.021 },
  "249": { iso: "SD", name: "Soudan", marketingEur: 0.021 },
  "211": { iso: "SS", name: "Soudan du Sud", marketingEur: 0.021 },
  "261": { iso: "MG", name: "Madagascar", marketingEur: 0.021 },
  "269": { iso: "KM", name: "Comores", marketingEur: 0.021 },
  "230": { iso: "MU", name: "Maurice", marketingEur: 0.021 },
  "248": { iso: "SC", name: "Seychelles", marketingEur: 0.021 },
  "258": { iso: "MZ", name: "Mozambique", marketingEur: 0.021 },
  "260": { iso: "ZM", name: "Zambie", marketingEur: 0.021 },
  "263": { iso: "ZW", name: "Zimbabwe", marketingEur: 0.021 },
  "265": { iso: "MW", name: "Malawi", marketingEur: 0.021 },
  "264": { iso: "NA", name: "Namibie", marketingEur: 0.021 },
  "267": { iso: "BW", name: "Botswana", marketingEur: 0.021 },
  "266": { iso: "LS", name: "Lesotho", marketingEur: 0.021 },
  "268": { iso: "SZ", name: "Eswatini", marketingEur: 0.021 },

  // --- Afrique : exceptions (tiers propres, plus chers) + Afrique du Nord ---
  "234": { iso: "NG", name: "Nigeria", marketingEur: 0.048 },
  "27": { iso: "ZA", name: "Afrique du Sud", marketingEur: 0.0263 },
  "20": { iso: "EG", name: "Égypte", marketingEur: 0.0997 },
  // Réunion / Mayotte (DOM français) → tarif France.
  "262": { iso: "RE", name: "Réunion / Mayotte", marketingEur: 0.0715 },

  // --- Moyen-Orient ---
  "971": { iso: "AE", name: "Émirats arabes unis", marketingEur: 0.0292 },
  "966": { iso: "SA", name: "Arabie saoudite", marketingEur: 0.0314 },
  "972": { iso: "IL", name: "Israël", marketingEur: 0.0296 },
  "90": { iso: "TR", name: "Turquie", marketingEur: 0.0073 },
  "961": { iso: "LB", name: "Liban", marketingEur: 0.0568 },
  "962": { iso: "JO", name: "Jordanie", marketingEur: 0.0568 },

  // --- Asie ---
  "91": { iso: "IN", name: "Inde", marketingEur: 0.0067 },
  "62": { iso: "ID", name: "Indonésie", marketingEur: 0.0378 },
  "60": { iso: "MY", name: "Malaisie", marketingEur: 0.0791 },
  "63": { iso: "PH", name: "Philippines", marketingEur: 0.0842 },
  "65": { iso: "SG", name: "Singapour", marketingEur: 0.0537 },
  "66": { iso: "TH", name: "Thaïlande", marketingEur: 0.0317 },
  "81": { iso: "JP", name: "Japon", marketingEur: 0.0732 },
  "82": { iso: "KR", name: "Corée du Sud", marketingEur: 0.0732 },
  "84": { iso: "VN", name: "Vietnam", marketingEur: 0.0379 },
  "86": { iso: "CN", name: "Chine", marketingEur: 0.0732 },
  "92": { iso: "PK", name: "Pakistan", marketingEur: 0.0435 },
  "880": { iso: "BD", name: "Bangladesh", marketingEur: 0.0067 },
  "977": { iso: "NP", name: "Népal", marketingEur: 0.021 },
  "94": { iso: "LK", name: "Sri Lanka", marketingEur: 0.021 },
  "95": { iso: "MM", name: "Myanmar", marketingEur: 0.042 },
  "93": { iso: "AF", name: "Afghanistan", marketingEur: 0.021 },

  // --- Océanie ---
  "61": { iso: "AU", name: "Australie", marketingEur: 0.0717 },
  "64": { iso: "NZ", name: "Nouvelle-Zélande", marketingEur: 0.0717 },
};

/** Indicatifs ordonnés du plus long au plus court — pour matcher
 *  correctement "+212" avant "+2" si jamais on en avait un. */
const PHONE_CODE_KEYS = Object.keys(PHONE_CODES).sort(
  (a, b) => b.length - a.length
);

/**
 * Extrait le pays d'un numéro de téléphone international.
 *
 * Accepte les formats "+33633921577", "0033633921577", "+33 6 33 92 ...".
 * Si l'indicatif n'est pas reconnu (ou si la chaîne ne ressemble pas à un
 * numéro), retourne `null` — le code appelant peut alors décider de
 * compter le coût avec FALLBACK ou de l'ignorer.
 */
export function extractCountry(rawPhone: string): PhoneCountry | null {
  if (!rawPhone) return null;
  // Garde les chiffres uniquement (avec un + initial s'il y en a un)
  const trimmed = rawPhone.trim();
  let digits: string;
  if (trimmed.startsWith("+")) {
    digits = trimmed.slice(1).replace(/\D/g, "");
  } else if (trimmed.startsWith("00")) {
    digits = trimmed.slice(2).replace(/\D/g, "");
  } else {
    // Pas de + ni de 00 → on suppose un local non identifiable
    return null;
  }
  if (digits.length < 4) return null;

  // Match le plus long préfixe possible (matched-greedy)
  for (const code of PHONE_CODE_KEYS) {
    if (digits.startsWith(code)) {
      return PHONE_CODES[code];
    }
  }
  return null;
}

/**
 * Coût Meta marketing pour UN numéro. Renvoie `FALLBACK.marketingEur`
 * pour les indicatifs inconnus afin que la somme totale d'un funnel
 * reste indicative même si quelques numéros sont mal formatés.
 */
export function metaMarketingCostEur(rawPhone: string): number {
  const country = extractCountry(rawPhone);
  return (country ?? FALLBACK).marketingEur;
}

/** Somme du coût marketing sur une liste de numéros. */
export function metaMarketingCostSumEur(phones: string[]): number {
  return phones.reduce((acc, p) => acc + metaMarketingCostEur(p), 0);
}

/** Une ligne du breakdown coût Meta : un pays + nb d'envois + tarif unitaire
 *  + total. Affichée dans la modale de détail accessible au clic sur la
 *  cellule « Coût Meta » d'un funnel ou d'un event Stats. */
export interface MetaCostByCountry {
  iso: string;
  name: string;
  count: number;
  rateEur: number;
  totalEur: number;
}

/**
 * Regroupe une liste de numéros par pays et calcule le coût total par
 * pays. Trié par totalEur décroissant (le pays le plus coûteux en haut).
 *
 * Le fallback (indicatif inconnu) est agrégé sous une seule ligne
 * « Autre / non reconnu » pour ne pas polluer le tableau.
 */
export function groupMetaCostsByCountry(phones: string[]): MetaCostByCountry[] {
  const groups = new Map<
    string,
    { iso: string; name: string; rateEur: number; count: number }
  >();
  for (const p of phones) {
    if (!p) continue;
    const country = extractCountry(p) ?? FALLBACK;
    const key = country.iso;
    const g = groups.get(key);
    if (g) g.count++;
    else
      groups.set(key, {
        iso: country.iso,
        name: country.name,
        rateEur: country.marketingEur,
        count: 1,
      });
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, totalEur: g.count * g.rateEur }))
    .sort((a, b) => b.totalEur - a.totalEur);
}

export const META_FALLBACK = FALLBACK;
