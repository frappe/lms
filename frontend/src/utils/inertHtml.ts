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

export const htmlToText = (html?: string | null): string =>
	inert(html ?? '').body.textContent || ''
