// Vite's `?worker` import bundles pdf.js's worker as a first-class worker module:
// it hands back a Worker *constructor*, picks the right classic/module type in
// dev, and emits a plain `.js` in prod (so nginx <1.21.1 never serves it as
// application/octet-stream — the failure the `?url`/raw-`.mjs` idiom trips on).
//
// Isolated in its own module so tests can mock worker creation without tripping
// over the worker transform (which can't run pdf.js's worker under vitest+jsdom).
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'

export function createPdfWorker() {
	return new PdfWorker()
}
