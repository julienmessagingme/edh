import * as XLSX from "xlsx";
import type { ComputedStep } from "./types";

function fileSafeName(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tableau"
  );
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

/**
 * Exporte le tableau (Étape, Volume, Conv vs précédent, Conv vs étape 1) en
 * fichier .xlsx. Inclut les sources individuelles indentées sous l'étape
 * quand celle-ci en cumule plusieurs.
 */
export function exportFunnelToExcel(args: {
  dashboardName: string;
  fromDate: string;
  toDate: string;
  steps: ComputedStep[];
}) {
  const { dashboardName, fromDate, toDate, steps } = args;
  const first = steps[0]?.count ?? 0;
  const rows: Array<Array<string | number>> = [];

  rows.push(["Tableau", dashboardName]);
  rows.push(["Période", `${fromDate} → ${toDate}`]);
  rows.push(["Exporté le", new Date().toLocaleString("fr-FR")]);
  rows.push([]);
  rows.push(["Étape", "Volume", "Conv. vs précédent", "Conv. vs étape 1"]);

  steps.forEach((s, i) => {
    const prev = i > 0 ? steps[i - 1].count : null;
    const convPrev =
      prev !== null && prev > 0 ? pct(s.count, prev) : i === 0 ? "—" : "—";
    const convFirst =
      i === 0 ? "—" : first > 0 ? pct(s.count, first) : "—";
    const label = `${i + 1}. ${s.label}${
      !s.available ? " (indisponible)" : ""
    }`;
    rows.push([label, s.count, convPrev, convFirst]);
    if (s.refs.length > 1) {
      s.refs.forEach((r) => {
        rows.push([
          `    · ${r.label}${!r.available ? " (indisponible)" : ""}`,
          r.count,
          "",
          "",
        ]);
      });
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Largeurs de colonne raisonnables
  ws["!cols"] = [{ wch: 50 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funnel");
  XLSX.writeFile(wb, `${fileSafeName(dashboardName)}.xlsx`);
}

/**
 * Capture le DOM de l'élément (chart + tableau) en image puis l'incorpore
 * dans un PDF A4 paysage avec un titre. Utilise `html-to-image` qui gère
 * les couleurs Tailwind v4 en `oklch()` (`html2canvas` ne sait pas les
 * parser). Libs chargées à la demande (`import()`).
 */
export async function exportFunnelToPDF(args: {
  element: HTMLElement;
  dashboardName: string;
  fromDate: string;
  toDate: string;
}) {
  const { element, dashboardName, fromDate, toDate } = args;

  const [{ toPng }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const dataUrl = await toPng(element, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
  });

  // Récupère les dimensions natives de l'image pour calculer le ratio.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 32;

  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(dashboardName, margin, margin + 8);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(120);
  pdf.text(
    `Période : ${fromDate} → ${toDate}   ·   Exporté le ${new Date().toLocaleString("fr-FR")}`,
    margin,
    margin + 26
  );
  pdf.setTextColor(0);

  const availWidth = pageWidth - margin * 2;
  const availHeight = pageHeight - margin * 2 - 48;
  const ratio = img.height / img.width;
  let drawWidth = availWidth;
  let drawHeight = drawWidth * ratio;
  if (drawHeight > availHeight) {
    drawHeight = availHeight;
    drawWidth = drawHeight / ratio;
  }
  pdf.addImage(dataUrl, "PNG", margin, margin + 48, drawWidth, drawHeight);

  pdf.save(`${fileSafeName(dashboardName)}.pdf`);
}
