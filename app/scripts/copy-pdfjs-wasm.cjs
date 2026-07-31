// pdfjs-dist 6.x decodes JBIG2/OpenJPEG-compressed PDF images (common in
// scanned-book PDFs, e.g. the Devi Mahatmyam English chapters) via WASM, and
// needs an explicit `wasmUrl` pointing at those .wasm files - see
// PdfViewer.jsx. Vite's `?url` import (used for pdf.worker.min.mjs) doesn't
// fit here because pdf.js builds each file's URL itself as `${wasmUrl}${
// filename}`, which needs the *original* filenames, not Vite's
// content-hashed ones. Copying the originals into public/ (served verbatim,
// unhashed) is the standard workaround. Runs via predev/prebuild so it stays
// in sync with whatever pdfjs-dist version is installed - see package.json.
const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'wasm')
const OUT_DIR = path.join(__dirname, '..', 'public', 'pdfjs-wasm')
const FILES = ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm', 'quickjs-eval.wasm']

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const file of FILES) {
  fs.copyFileSync(path.join(SRC_DIR, file), path.join(OUT_DIR, file))
}
console.log(`Copied ${FILES.length} pdf.js wasm files to public/pdfjs-wasm/`)
