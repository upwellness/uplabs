/**
 * UP Labs v2 · Plate Planner — PDF export (raster → multi-page A4, NO popup)
 * ──────────────────────────────────────────────────────────────────────────
 * Replaces the old window.open()+print() path (popup was being blocked). Instead:
 *   1. The designed report (./_PlateReport) is already mounted OFF-CANVAS by page.tsx.
 *   2. html-to-image rasterizes that node to a single tall PNG.
 *   3. jsPDF places the PNG on A4 pages, slicing it across pages by re-drawing the SAME
 *      full image with a NEGATIVE y-offset and clipping to the page — a 7/14/30-day plan
 *      paginates cleanly with no content cut mid-line beyond page seams.
 *   4. doc.save(...) downloads "แผนอาหาร-<who>.pdf" directly (no print dialog).
 *
 * Both heavy deps are dynamic-imported HERE so they never enter first-load JS
 * (html-to-image is shared with bca/designer; jspdf is added for this feature).
 */

const A4_W = 210; // mm
const A4_H = 297; // mm
const MARGIN = 8; // mm — small uniform margin so each page reads as a clean document

/**
 * Rasterize `node` and save a multi-page A4 PDF.
 * @returns nothing — throws on failure so the caller surfaces the error.
 */
export async function exportPlatePdf(node: HTMLElement, fileBase: string): Promise<void> {
  // Lazy — keep html-to-image + jspdf out of the page's first-load bundle.
  const [{ toPng }, jsPDFmod] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const JsPDF = jsPDFmod.jsPDF;

  // High-DPI raster of the off-canvas report (white bg so transparency → paper white).
  const dataUrl = await toPng(node, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
    skipFonts: true, // use the page's already-loaded fonts; skip @font-face embedding (avoids CORS/timeout failures)
  });

  // Natural pixel size of the raster (needed for the px↔mm scale + slicing).
  const img = await loadImage(dataUrl);
  const pxW = img.naturalWidth;
  const pxH = img.naturalHeight;

  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Fit the image width to the printable width; height scales proportionally.
  const printW = A4_W - MARGIN * 2;
  const printH = A4_H - MARGIN * 2;
  const imgWmm = printW;
  const imgHmm = (pxH / pxW) * imgWmm; // full image height in mm at this width

  if (imgHmm <= printH + 0.5) {
    // Single page — no slicing needed.
    doc.addImage(dataUrl, "PNG", MARGIN, MARGIN, imgWmm, imgHmm, undefined, "FAST");
  } else {
    // Multi-page: crop the source PNG into per-page bands on a <canvas> and add each as its
    // own image. Robust — avoids the jsPDF clip API (saveGraphicsState/clip/discardPath),
    // which is brittle across jsPDF versions.
    const pageHpx = Math.floor((printH / imgWmm) * pxW); // source px that fill one printable page
    const pageCount = Math.ceil(pxH / pageHpx);
    for (let p = 0; p < pageCount; p++) {
      const sy = p * pageHpx;
      const sH = Math.min(pageHpx, pxH - sy);
      const canvas = document.createElement("canvas");
      canvas.width = pxW;
      canvas.height = sH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับการสร้าง PDF");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pxW, sH);
      ctx.drawImage(img, 0, sy, pxW, sH, 0, 0, pxW, sH); // crop band from the full raster
      if (p > 0) doc.addPage();
      doc.addImage(canvas.toDataURL("image/png"), "PNG", MARGIN, MARGIN, imgWmm, (sH / pxW) * imgWmm, undefined, "FAST");
    }
  }

  const safe = (fileBase || "plan").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "plan";
  doc.save(`แผนอาหาร-${safe}.pdf`);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("ไม่สามารถอ่านรูปที่สร้างได้"));
    im.src = src;
  });
}
