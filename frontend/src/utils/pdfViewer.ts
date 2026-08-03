// WebKit refuses to scroll a PDF inside an <iframe>, and on iOS/iPadOS every
// browser is WebKit, so the lesson PDF shows page 1 or nothing. Those engines
// get the inline pdf.js viewer (PdfBlock.vue); everywhere else keeps the native
// <iframe> plugin, which is faster, has the browser's own toolbar, and doesn't
// ship ~144kB of pdf.js.
export function usesWebkitPdfViewer(nav: Navigator = navigator): boolean {
	const ua = nav.userAgent || ''
	// iPadOS 13+ reports itself as MacIntel, so touch points disambiguate it.
	const isIOS =
		/iP(hone|ad|od)/.test(ua) ||
		(nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
	// Blink and Gecko both carry "AppleWebKit" in their UA for legacy reasons;
	// their own engine tokens are what actually rule Safari out.
	const isSafari =
		/AppleWebKit/.test(ua) && !/Chrom(e|ium)|Edg\/|OPR\//.test(ua)
	return isIOS || isSafari
}
