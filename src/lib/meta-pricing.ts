/**
 * Tarifs Meta WhatsApp Business — catégorie MARKETING — par pays.
 *
 * Source : outil de tarification officiel Meta
 *   https://whatsappbusiness.com/products/platform-pricing/
 *   (catégorie = Marketing, devise = EUR), récupéré le 2026-06-30 via son
 *   endpoint `wp-json/wab/v1/pricing`. Valeurs EN EUR par message marketing
 *   sortant, pour un compte WABA facturé en euros.
 *
 * Modèle Meta (depuis juillet 2025) : facturation AU MESSAGE selon
 * l'indicatif du destinataire. Beaucoup de pays n'ont pas de tarif propre
 * et tombent dans un TIER RÉGIONAL :
 *   - AFR  « Reste de l'Afrique »            0,0186 €  (toute l'Afrique
 *           subsaharienne + Maghreb hors Égypte ; Égypte/Afrique du Sud/
 *           Nigeria ont leur propre tarif)
 *   - WEU  « Reste de l'Europe occidentale » 0,0490 €
 *   - CEEU « Reste de l'Europe centrale/Est »0,0712 €
 *   - MDE  « Reste du Moyen-Orient »          0,0282 €
 *   - APAC « Reste de l'Asie-Pacifique »      0,0606 €
 *   - NAM  « Amérique du Nord » (US/Canada)   0,0207 €
 *   - GLO  « Autre »                          0,0500 €  (fallback)
 *
 * Meta révise ses tarifs ~2×/an : re-vérifier périodiquement sur l'outil
 * ci-dessus (sélecteur marché + devise EUR + catégorie Marketing).
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
 *  pour les pays absents du tableau ci-dessous. = tier « Other » (GLO) de
 *  Meta, 0,05 € (officiel, EUR/Marketing). */
const FALLBACK: PhoneCountry = {
  iso: "XX",
  name: "Autre / non reconnu",
  marketingEur: 0.05,
};

/**
 * Map indicatif téléphonique → pays + tarif marketing EUR officiel Meta.
 * Le tarif est celui du MARCHÉ Meta du pays : soit son marché propre
 * (France, Allemagne, Égypte…), soit son tier régional (cf. en-tête).
 *
 * `extractCountry` matche le préfixe le plus long d'abord (ex : "351"
 * Portugal avant "35", "212" Maroc avant "21").
 */
const PHONE_CODES: Record<string, PhoneCountry> = {
  // --- Europe de l'Ouest (marchés propres) ---
  "33": { iso: "FR", name: "France", marketingEur: 0.0712 },
  "49": { iso: "DE", name: "Allemagne", marketingEur: 0.1131 },
  "34": { iso: "ES", name: "Espagne", marketingEur: 0.0509 },
  "39": { iso: "IT", name: "Italie", marketingEur: 0.0572 },
  "44": { iso: "GB", name: "Royaume-Uni", marketingEur: 0.0438 },
  "31": { iso: "NL", name: "Pays-Bas", marketingEur: 0.1323 },

  // --- Europe de l'Ouest (tier « Reste de l'Europe occidentale » 0,049 €) ---
  "32": { iso: "BE", name: "Belgique", marketingEur: 0.049 },
  "41": { iso: "CH", name: "Suisse", marketingEur: 0.049 },
  "43": { iso: "AT", name: "Autriche", marketingEur: 0.049 },
  "351": { iso: "PT", name: "Portugal", marketingEur: 0.049 },
  "353": { iso: "IE", name: "Irlande", marketingEur: 0.049 },
  "352": { iso: "LU", name: "Luxembourg", marketingEur: 0.049 },
  "45": { iso: "DK", name: "Danemark", marketingEur: 0.049 },
  "46": { iso: "SE", name: "Suède", marketingEur: 0.049 },
  "47": { iso: "NO", name: "Norvège", marketingEur: 0.049 },
  "358": { iso: "FI", name: "Finlande", marketingEur: 0.049 },
  "30": { iso: "GR", name: "Grèce", marketingEur: 0.049 },

  // --- Europe centrale/orientale + Caucase (tier CEEU 0,0712 €) ---
  "48": { iso: "PL", name: "Pologne", marketingEur: 0.0712 },
  "40": { iso: "RO", name: "Roumanie", marketingEur: 0.0712 },
  "420": { iso: "CZ", name: "Tchéquie", marketingEur: 0.0712 },
  "36": { iso: "HU", name: "Hongrie", marketingEur: 0.0712 },
  "359": { iso: "BG", name: "Bulgarie", marketingEur: 0.0712 },
  "421": { iso: "SK", name: "Slovaquie", marketingEur: 0.0712 },
  "386": { iso: "SI", name: "Slovénie", marketingEur: 0.0712 },
  "385": { iso: "HR", name: "Croatie", marketingEur: 0.0712 },
  "380": { iso: "UA", name: "Ukraine", marketingEur: 0.0712 },
  "381": { iso: "RS", name: "Serbie", marketingEur: 0.0712 },
  "370": { iso: "LT", name: "Lituanie", marketingEur: 0.0712 },
  "371": { iso: "LV", name: "Lettonie", marketingEur: 0.0712 },
  "372": { iso: "EE", name: "Estonie", marketingEur: 0.0712 },
  "995": { iso: "GE", name: "Géorgie", marketingEur: 0.0712 },
  "7": { iso: "RU", name: "Russie / Kazakhstan", marketingEur: 0.0664 },

  // --- Amérique du Nord (tier NAM 0,0207 €) ---
  "1": { iso: "US", name: "USA / Canada", marketingEur: 0.0207 },

  // --- Amérique latine (marchés propres ; autres → « Autre ») ---
  "52": { iso: "MX", name: "Mexique", marketingEur: 0.0253 },
  "55": { iso: "BR", name: "Brésil", marketingEur: 0.0518 },
  "54": { iso: "AR", name: "Argentine", marketingEur: 0.0512 },
  "56": { iso: "CL", name: "Chili", marketingEur: 0.0736 },
  "57": { iso: "CO", name: "Colombie", marketingEur: 0.0104 },
  "51": { iso: "PE", name: "Pérou", marketingEur: 0.0582 },

  // --- Afrique : marchés propres ---
  "20": { iso: "EG", name: "Égypte", marketingEur: 0.0533 },
  "27": { iso: "ZA", name: "Afrique du Sud", marketingEur: 0.0314 },
  "234": { iso: "NG", name: "Nigeria", marketingEur: 0.0428 },

  // --- Afrique : tout le reste, tier « Reste de l'Afrique » 0,0186 €
  //     (Maghreb inclus : Maroc / Algérie / Tunisie n'ont pas de marché
  //     propre côté Meta et tombent dans ce tier). ---
  "212": { iso: "MA", name: "Maroc", marketingEur: 0.0186 },
  "213": { iso: "DZ", name: "Algérie", marketingEur: 0.0186 },
  "216": { iso: "TN", name: "Tunisie", marketingEur: 0.0186 },
  "221": { iso: "SN", name: "Sénégal", marketingEur: 0.0186 },
  "225": { iso: "CI", name: "Côte d'Ivoire", marketingEur: 0.0186 },
  "223": { iso: "ML", name: "Mali", marketingEur: 0.0186 },
  "226": { iso: "BF", name: "Burkina Faso", marketingEur: 0.0186 },
  "228": { iso: "TG", name: "Togo", marketingEur: 0.0186 },
  "229": { iso: "BJ", name: "Bénin", marketingEur: 0.0186 },
  "227": { iso: "NE", name: "Niger", marketingEur: 0.0186 },
  "224": { iso: "GN", name: "Guinée", marketingEur: 0.0186 },
  "245": { iso: "GW", name: "Guinée-Bissau", marketingEur: 0.0186 },
  "222": { iso: "MR", name: "Mauritanie", marketingEur: 0.0186 },
  "220": { iso: "GM", name: "Gambie", marketingEur: 0.0186 },
  "231": { iso: "LR", name: "Liberia", marketingEur: 0.0186 },
  "232": { iso: "SL", name: "Sierra Leone", marketingEur: 0.0186 },
  "233": { iso: "GH", name: "Ghana", marketingEur: 0.0186 },
  "238": { iso: "CV", name: "Cap-Vert", marketingEur: 0.0186 },
  "237": { iso: "CM", name: "Cameroun", marketingEur: 0.0186 },
  "241": { iso: "GA", name: "Gabon", marketingEur: 0.0186 },
  "240": { iso: "GQ", name: "Guinée équatoriale", marketingEur: 0.0186 },
  "236": { iso: "CF", name: "Centrafrique", marketingEur: 0.0186 },
  "235": { iso: "TD", name: "Tchad", marketingEur: 0.0186 },
  "242": { iso: "CG", name: "Congo-Brazzaville", marketingEur: 0.0186 },
  "243": { iso: "CD", name: "RD Congo", marketingEur: 0.0186 },
  "239": { iso: "ST", name: "Sao Tomé-et-Principe", marketingEur: 0.0186 },
  "254": { iso: "KE", name: "Kenya", marketingEur: 0.0186 },
  "255": { iso: "TZ", name: "Tanzanie", marketingEur: 0.0186 },
  "256": { iso: "UG", name: "Ouganda", marketingEur: 0.0186 },
  "250": { iso: "RW", name: "Rwanda", marketingEur: 0.0186 },
  "257": { iso: "BI", name: "Burundi", marketingEur: 0.0186 },
  "251": { iso: "ET", name: "Éthiopie", marketingEur: 0.0186 },
  "252": { iso: "SO", name: "Somalie", marketingEur: 0.0186 },
  "253": { iso: "DJ", name: "Djibouti", marketingEur: 0.0186 },
  "249": { iso: "SD", name: "Soudan", marketingEur: 0.0186 },
  "211": { iso: "SS", name: "Soudan du Sud", marketingEur: 0.0186 },
  "261": { iso: "MG", name: "Madagascar", marketingEur: 0.0186 },
  "269": { iso: "KM", name: "Comores", marketingEur: 0.0186 },
  "230": { iso: "MU", name: "Maurice", marketingEur: 0.0186 },
  "248": { iso: "SC", name: "Seychelles", marketingEur: 0.0186 },
  "258": { iso: "MZ", name: "Mozambique", marketingEur: 0.0186 },
  "260": { iso: "ZM", name: "Zambie", marketingEur: 0.0186 },
  "263": { iso: "ZW", name: "Zimbabwe", marketingEur: 0.0186 },
  "265": { iso: "MW", name: "Malawi", marketingEur: 0.0186 },
  "264": { iso: "NA", name: "Namibie", marketingEur: 0.0186 },
  "267": { iso: "BW", name: "Botswana", marketingEur: 0.0186 },
  "266": { iso: "LS", name: "Lesotho", marketingEur: 0.0186 },
  "268": { iso: "SZ", name: "Eswatini", marketingEur: 0.0186 },
  // Réunion / Mayotte (DOM français, +262) → tarif France.
  "262": { iso: "RE", name: "Réunion / Mayotte", marketingEur: 0.0712 },

  // --- Moyen-Orient (marchés propres + tier MDE 0,0282 €) ---
  "971": { iso: "AE", name: "Émirats arabes unis", marketingEur: 0.0415 },
  "966": { iso: "SA", name: "Arabie saoudite", marketingEur: 0.0414 },
  "972": { iso: "IL", name: "Israël", marketingEur: 0.0292 },
  "90": { iso: "TR", name: "Turquie", marketingEur: 0.009 },
  "961": { iso: "LB", name: "Liban", marketingEur: 0.0282 },
  "962": { iso: "JO", name: "Jordanie", marketingEur: 0.0282 },

  // --- Asie (marchés propres + tier APAC 0,0606 €) ---
  "91": { iso: "IN", name: "Inde", marketingEur: 0.0099 },
  "62": { iso: "ID", name: "Indonésie", marketingEur: 0.0341 },
  "60": { iso: "MY", name: "Malaisie", marketingEur: 0.0712 },
  "92": { iso: "PK", name: "Pakistan", marketingEur: 0.0392 },
  "81": { iso: "JP", name: "Japon", marketingEur: 0.0606 },
  "82": { iso: "KR", name: "Corée du Sud", marketingEur: 0.0606 },
  "86": { iso: "CN", name: "Chine", marketingEur: 0.0606 },
  "84": { iso: "VN", name: "Vietnam", marketingEur: 0.0606 },
  "66": { iso: "TH", name: "Thaïlande", marketingEur: 0.0606 },
  "65": { iso: "SG", name: "Singapour", marketingEur: 0.0606 },
  "63": { iso: "PH", name: "Philippines", marketingEur: 0.0606 },
  "880": { iso: "BD", name: "Bangladesh", marketingEur: 0.0606 },
  "977": { iso: "NP", name: "Népal", marketingEur: 0.0606 },
  "94": { iso: "LK", name: "Sri Lanka", marketingEur: 0.0606 },
  "95": { iso: "MM", name: "Myanmar", marketingEur: 0.0606 },
  "93": { iso: "AF", name: "Afghanistan", marketingEur: 0.0606 },

  // --- Océanie (tier APAC 0,0606 €) ---
  "61": { iso: "AU", name: "Australie", marketingEur: 0.0606 },
  "64": { iso: "NZ", name: "Nouvelle-Zélande", marketingEur: 0.0606 },
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
