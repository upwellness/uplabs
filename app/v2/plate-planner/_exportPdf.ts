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
    // Multi-page: draw the FULL image once per page, shifted up by the page's slice
    // (negative y), and clip to the printable box so only that slice shows. This is the
    // standard "tall canvas across A4" technique and avoids re-rasterizing per page.
    const pageCount = Math.ceil(imgHmm / printH);
    for (let p = 0; p < pageCount; p++) {
      if (p > 0) doc.addPage();
      const yShift = MARGIN - p * printH; // top of full image relative to this page
      // Clip so the overflow above/below the printable box is hidden. rect(...,null) lays
      // down ONLY a path (no stroke/fill); clip()+discardPath() turns it into the clip region.
      doc.saveGraphicsState();
      doc.rect(MARGIN, MARGIN, printW, printH, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(dataUrl, "PNG", MARGIN, yShift, imgWmm, imgHmm, undefined, "FAST");
      doc.restoreGraphicsState();
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
