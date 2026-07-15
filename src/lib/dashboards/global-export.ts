/**
 * Export PDF du rapport « Global » : un document TEXTE (pas de capture image),
 * rendu nativement avec jsPDF → texte sélectionnable, multi-page propre, et
 * un en-tête avec le logo + le nom de l'école en gros en haut à gauche.
 *
 * Volontairement séparé de `export.ts` (qui importe `xlsx` en top-level) pour
 * que la page Global ne tire pas tout `xlsx` dans son bundle. `jspdf` est
 * chargé à la demande (`import()`).
 */

/** 1 ligne du rapport d'un funnel. `b` non-null uniquement en comparaison. */
export interface GlobalReportLine {
  label: string;
  /** envois = lancement brut ; echec = échecs WhatsApp ; net = envois − échecs ;
   *  step = étape du funnel. Pilote la mise en forme (gras / rouge / indentation). */
  kind: "envois" | "echec" | "net" | "step";
  a: number;
  b: number | null;
}

export interface GlobalReportFunnel {
  name: string;
  isShared: boolean;
  /** true = funnel sans aucune étape (rien à afficher hormis le titre). */
  empty: boolean;
  lines: GlobalReportLine[];
}

export interface GlobalReportMeta {
  schoolName: string;
  /** URL même-origine du logo (ex. /logos/efap.png). Best-effort : si le
   *  chargement échoue, le PDF est produit sans logo (nom seul). */
  logoUrl: string;
  compare: boolean;
  rangeA: { from: string; to: string };
  rangeB: { from: string; to: string } | null;
}

const fmt = (n: number): string => n.toLocaleString("fr-FR");

function fileSafeName(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "rapport"
  );
}

/** Charge une image même-origine et la convertit en dataURL PNG + dimensions
 *  natives (pour respecter le ratio dans le PDF). Null si échec. */
async function loadLogo(
  url: string
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      w: img.naturalWidth,
      h: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

export async function exportGlobalReportToPDF(
  meta: GlobalReportMeta,
  funnels: GlobalReportFunnel[]
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const xRight = pageW - margin;
  let y = margin;

  // --- En-tête : logo + nom d'école en gros, haut à gauche ---
  const logo = await loadLogo(meta.logoUrl);
  if (logo) {
    const logoH = 48;
    const logoW = Math.min(150, logoH * (logo.w / logo.h));
    pdf.addImage(logo.dataUrl, "PNG", margin, y, logoW, logoH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.setTextColor(20);
    pdf.text(meta.schoolName, margin + logoW + 16, y + 32);
    y += logoH;
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.setTextColor(20);
    pdf.text(meta.schoolName, margin, y + 26);
    y += 34;
  }
  y += 20;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(90);
  pdf.text("Rapport global des funnels", margin, y);
  y += 16;

  pdf.setFontSize(9.5);
  pdf.setTextColor(120);
  if (meta.compare && meta.rangeB) {
    pdf.text(`Période A : du ${meta.rangeA.from} au ${meta.rangeA.to}`, margin, y);
    y += 12;
    pdf.text(`Période B : du ${meta.rangeB.from} au ${meta.rangeB.to}`, margin, y);
    y += 12;
  } else {
    pdf.text(`Période : du ${meta.rangeA.from} au ${meta.rangeA.to}`, margin, y);
    y += 12;
  }
  pdf.text(`Exporté le ${new Date().toLocaleString("fr-FR")}`, margin, y);
  y += 10;

  pdf.setDrawColor(210);
  pdf.setLineWidth(0.8);
  pdf.line(margin, y, xRight, y);
  y += 18;

  // Colonnes de valeurs (droite). En comparaison : A / B / Δ / Δ%.
  const numColW = 58;
  const xA = xRight - numColW * 3;
  const xB = xRight - numColW * 2;
  const xD = xRight - numColW;
  const xP = xRight;

  function drawColHeader() {
    if (!meta.compare) return;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    // NB : helvetica encode en WinAnsi (cp1252) → pas de « Δ » grec (il
    // sortirait cassé, cf. le même piège avec « → » dans export.ts). On
    // écrit « Écart » (les lettres accentuées, elles, sont dans cp1252).
    pdf.text("A", xA, y, { align: "right" });
    pdf.text("B", xB, y, { align: "right" });
    pdf.text("Écart", xD, y, { align: "right" });
    pdf.text("Écart %", xP, y, { align: "right" });
    y += 12;
  }

  function ensure(h: number) {
    if (y + h > pageH - margin) {
      pdf.addPage();
      y = margin;
      drawColHeader();
    }
  }

  drawColHeader();

  if (funnels.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(11);
    pdf.setTextColor(140);
    pdf.text("Aucun funnel dans cette école.", margin, y + 6);
    pdf.save(`rapport-global-${fileSafeName(meta.schoolName)}.pdf`);
    return;
  }

  const labelMaxW =
    (meta.compare ? xA - numColW : xRight - 70) - margin - 16;

  for (const f of funnels) {
    // Bandeau titre du funnel (frame propre) : rectangle gris clair + nom.
    const titleText = f.name + (f.isShared ? "   (partagé)" : "");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12.5);
    const nameLines = pdf.splitTextToSize(titleText, pageW - margin * 2 - 16);
    const bandH = 8 + nameLines.length * 15 + 6;
    ensure(bandH + 24);
    pdf.setFillColor(243, 244, 246); // zinc-100
    pdf.setDrawColor(228);
    pdf.setLineWidth(0.6);
    pdf.roundedRect(margin, y, pageW - margin * 2, bandH, 3, 3, "FD");
    pdf.setTextColor(24);
    pdf.text(nameLines, margin + 10, y + 18);
    y += bandH + 10;

    if (f.empty) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      pdf.text("Funnel vide (aucune étape).", margin + 12, y + 6);
      y += 24;
    } else {
      for (const line of f.lines) {
        const bold = line.kind === "envois" || line.kind === "net";
        const indent = line.kind === "step" ? 18 : 10;
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(10.5);
        const lab = pdf.splitTextToSize(line.label, labelMaxW);
        ensure(Math.max(lab.length * 13, 16) + 2);

        // Label
        if (line.kind === "echec") pdf.setTextColor(200, 60, 60);
        else pdf.setTextColor(bold ? 20 : 70);
        pdf.text(lab, margin + indent, y + 9);

        // Valeurs
        if (line.kind === "echec") pdf.setTextColor(200, 60, 60);
        else pdf.setTextColor(bold ? 20 : 55);
        if (meta.compare) {
          pdf.text(fmt(line.a), xA, y + 9, { align: "right" });
          pdf.text(line.b == null ? "" : fmt(line.b), xB, y + 9, {
            align: "right",
          });
          if (line.b != null) {
            const delta = line.a - line.b;
            const up = delta > 0;
            const flat = delta === 0;
            if (flat) pdf.setTextColor(150);
            else if (up) pdf.setTextColor(34, 150, 83);
            else pdf.setTextColor(200, 55, 55);
            pdf.text(`${up ? "+" : ""}${fmt(delta)}`, xD, y + 9, {
              align: "right",
            });
            const pctStr =
              line.b > 0
                ? `${up ? "+" : ""}${((delta / line.b) * 100).toFixed(1)} %`
                : "n/a";
            pdf.text(pctStr, xP, y + 9, { align: "right" });
          }
        } else {
          pdf.text(fmt(line.a), xRight, y + 9, { align: "right" });
        }
        pdf.setTextColor(0);
        y += Math.max(lab.length * 13, 16) + 2;
      }
    }

    y += 6;
    pdf.setDrawColor(232);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, xRight, y);
    y += 16;
  }

  pdf.save(`rapport-global-${fileSafeName(meta.schoolName)}.pdf`);
}
