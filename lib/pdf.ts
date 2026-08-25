import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export async function exportPdfFromParts(
  headerEl: HTMLElement | null,
  bodyEl: HTMLElement | null,
  filename: string,
) {
  if (!headerEl || !bodyEl) return;

  await document.fonts.ready;

  const [headerCanvas, bodyCanvas] = await Promise.all([
    html2canvas(headerEl, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    }),
    html2canvas(bodyEl, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    }),
  ]);

  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;

  const imgW = pageW - margin * 2;
  const headerImgH = (headerCanvas.height * imgW) / headerCanvas.width;
  const bodyImgH = (bodyCanvas.height * imgW) / bodyCanvas.width;

  const bodyTop = margin + headerImgH + 8;
  const contentH = pageH - bodyTop - 14;

  let y = 0;
  let first = true;
  do {
    if (!first) pdf.addPage();
    first = false;

    pdf.addImage(
      headerCanvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      margin,
      margin,
      imgW,
      headerImgH,
    );
    pdf.addImage(
      bodyCanvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      margin,
      bodyTop + y,
      imgW,
      bodyImgH,
    );

    y -= contentH;
  } while (bodyImgH + y > 0);

  pdf.save(filename);
}
