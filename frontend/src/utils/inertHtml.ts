// Both helpers here read untrusted HTML, and both used to do it by writing it
// into a node in the live document. That is not inert: an <img src=x
// onerror=...> loads and fires even while detached, so the markup ran before
// anything sanitized it. A DOMParser document has no browsing context, so
// nothing in it fetches or runs.
//
// They live together in their own module because decodeEntities is the one place
// in the app that assigns innerHTML from a value on purpose, and the innerHTML
// gate in tests/htmlSinkSafety.test.ts exempts this path — an exemption is only
// honest when it covers nothing else.

const inert = (html: string): Document =>
	new DOMParser().parseFromString(html, 'text/html')

// Bios and notification subjects arrive HTML-escaped and reach here before
// v-safe-html sees them, so the sanitizer cannot be what protects this write.
// The textarea stays because it is what keeps raw tags as text: decoding through
// textContent would strip the HTML a bio is allowed to carry, which the profile
// then renders through v-safe-html:bio.
export const decodeEntities = (encodedString?: string | null): string => {
	const textarea = inert('<textarea></textarea>').querySelector(
		'textarea'
	) as HTMLTextAreaElement
	textarea.innerHTML = encodedString ?? ''
	return textarea.value
}

// The blocks a rich-text editor writes. textContent joins them with nothing in
// between, so `<p>First</p><p>Second</p>` came out as `FirstSecond`. Every
// consumer is a one-line `truncate` preview, where that costs a word boundary.
const BLOCKS = 'p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,br'

export const htmlToText = (html?: string | null): string => {
	const doc = inert(html ?? '')
	// after(), not a string join. The separator is a text node in the parsed
	// document, so nothing is re-serialised and re-parsed on the way out.
	doc.body.querySelectorAll(BLOCKS).forEach((block) => block.after(' '))
	return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}
