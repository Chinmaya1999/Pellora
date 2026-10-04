// Builds the downloadable PDF skin report: overall score, every score bar, and each analysis overlay image.
import { BRAND } from "../brand";

const RATING = { Excellent: [22, 163, 74], Good: [34, 150, 120], Fair: [217, 119, 6], Poor: [220, 38, 38] };
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

async function toJpeg(src, maxW = 900) { // downscale so the PDF stays small
  const i = await loadImg(src), k = Math.min(1, maxW / i.naturalWidth);
  const c = document.createElement("canvas"); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k);
  c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
  return { data: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height };
}

export async function downloadReport(d, { photoUrl, mirror, name } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  const list = Object.values(d.metrics);
  let y = 0;

  const header = () => {
    doc.setFillColor(79, 70, 229); doc.rect(0, 0, W, 54, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(`${BRAND} Skin Report`, M, 34);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(new Date().toLocaleString(), W - M, 34, { align: "right" });
    doc.setTextColor(30); y = 82;
  };
  const room = (h) => { if (y + h > H - 50) { doc.addPage(); header(); } };

  header();
  if (name) { doc.setFontSize(11); doc.setTextColor(90); doc.text(`Prepared for ${name}`, M, y); doc.setTextColor(30); y += 22; }

  // Summary: photo + big score
  let photoW = 0;
  if (photoUrl) {
    try {
      const p = await toJpeg(photoUrl, 600); photoW = 150; const ph = (p.h / p.w) * photoW;
      if (mirror) { const c = document.createElement("canvas"), i = await loadImg(p.data); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(i, 0, 0); p.data = c.toDataURL("image/jpeg", 0.85); }
      doc.addImage(p.data, "JPEG", M, y, photoW, ph); photoW += 22;
    } catch { photoW = 0; }
  }
  const sx = M + photoW;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(110); doc.text("OVERALL SKIN SCORE", sx, y + 14);
  doc.setFontSize(54); doc.setTextColor(79, 70, 229); doc.text(String(d.overall_score), sx, y + 70);
  doc.setFontSize(11); doc.setTextColor(90); doc.setFont("helvetica", "normal");
  doc.text(`out of 100 · ${list.length} measurements`, sx, y + 90);
  doc.text(`Photo quality: ${d.quality?.score ?? "-"}/100${d.quality?.issues?.length ? ` (${d.quality.issues.join(", ").replaceAll("_", " ")})` : ""}`, sx, y + 108);
  y += Math.max(photoW ? 190 : 0, 128);

  // Score bars
  doc.setTextColor(30); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("All skin scores", M, y); y += 16;
  doc.setFontSize(10.5);
  for (const m of list) {
    room(22);
    const col = RATING[m.rating] || [90, 90, 90];
    doc.setFont("helvetica", "normal"); doc.setTextColor(30); doc.text(m.label, M, y + 9);
    doc.setFillColor(231, 233, 240); doc.roundedRect(M + 150, y, 250, 10, 5, 5, "F");
    doc.setFillColor(...col); doc.roundedRect(M + 150, y, Math.max(8, 2.5 * m.score), 10, 5, 5, "F");
    doc.setFont("helvetica", "bold"); doc.setTextColor(...col); doc.text(m.rating, M + 412, y + 9);
    doc.setTextColor(30); doc.text(String(m.score), W - M, y + 9, { align: "right" });
    y += 22;
  }
  y += 10;

  // Overlay images, two per row
  room(40); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30); doc.text("Analysis overlays", M, y); y += 14;
  const gap = 16, cw = (W - 2 * M - gap) / 2;
  const items = list.filter((m) => m.overlay_jpeg_base64);
  for (let i = 0; i < items.length; i += 2) {
    const row = await Promise.all(items.slice(i, i + 2).map(async (m) => ({ m, img: await toJpeg(`data:image/jpeg;base64,${m.overlay_jpeg_base64}`) })));
    const rh = Math.max(...row.map((r) => (r.img.h / r.img.w) * cw)) + 34;
    room(rh); 
    row.forEach(({ m, img }, j) => {
      const x = M + j * (cw + gap), ih = (img.h / img.w) * cw, col = RATING[m.rating] || [90, 90, 90];
      doc.addImage(img.data, "JPEG", x, y, cw, ih);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30); doc.text(m.label, x, y + ih + 15);
      doc.setTextColor(...col); doc.text(`${m.score} · ${m.rating}`, x + cw, y + ih + 15, { align: "right" });
    });
    y += rh;
  }

  if (d.disclaimer) {
    room(50); doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(120);
    doc.text(doc.splitTextToSize(d.disclaimer, W - 2 * M), M, y + 10);
  }
  doc.save(`skin-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
