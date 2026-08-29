import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
const [, , chemin, de, a] = process.argv;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(chemin)) }).promise;
for (let i = Number(de); i <= Math.min(Number(a), doc.numPages); i++) {
  const c = await (await doc.getPage(i)).getTextContent();
  let ligne = "", y = null; const out = [];
  for (const it of c.items) { if (!("str" in it)) continue;
    const ny = Math.round(it.transform[5]);
    if (y !== null && Math.abs(ny - y) > 2.5) { if (ligne.trim()) out.push(ligne.trim()); ligne = ""; }
    y = ny; ligne += it.str + " "; }
  if (ligne.trim()) out.push(ligne.trim());
  console.log(`--- page ${i} ---`); console.log(out.join("\n"));
}
