import DOMPurify from 'dompurify'
import type { Config } from 'dompurify'
import { safeUrl } from '@/utils/safeUrl'

// Three profiles, because the codebase already had three. Each one is the
// config its call sites use today — this module is a consolidation, not a
// policy change. Widening any of these is a separate, tested change.
const purifier = DOMPurify()

// Every rendered anchor opens in a new tab with safe rel attributes. EditorJS's
// link tool creates bare <a href> via execCommand, and DOMPurify strips target
// by default, so without this a lesson hyperlink navigates away and the student
// loses their place. Applies at every level, not only rich.
purifier.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A') {
		node.setAttribute('target', '_blank')
		node.setAttribute('rel', 'noopener noreferrer')
	}
})

// A protocol-relative src was the standard YouTube/Vimeo embed snippet for
// years, so it is the likeliest thing a migrated lesson body holds. safeUrl
// rejects it, correctly, for an attribute the browser would fetch off-origin —
// but as a link it is exactly the URL the reader wants, so it gets an explicit
// https rather than being dropped.
const embedUrl = (src: string | null): string | undefined =>
	safeUrl(src && /^\/\/[^/\\]/.test(src) ? `https:${src}` : src)

// No profile allows <iframe>, and none should: an embed reaches the page as a
// block component with a bound, scheme-checked src, never as authored markup.
// But dropping one silently loses whatever it pointed at. Frappe's save-time
// allowlist has no iframe either (utils/html_utils.py, acceptable_elements), so
// a Text Editor field cannot carry one — lesson bodies, however, are EditorJS
// JSON, and sanitize_html returns JSON untouched, so a row migrated from the
// jinja portal still can. Rendering the source as a link keeps that content
// reachable and grants no new embedding power: the href clears the same scheme
// allowlist as every other bound URL, and a rejected one leaves nothing behind.
//
// It runs inside DOMPurify's own traversal rather than as a pass over the string
// first, for two reasons. Re-serialising and re-parsing untrusted markup is how
// mutation XSS gets a second chance at the parser, and by the time a hook sees a
// node the parser has already settled tag case and nesting — a pass that greps
// the source for '<iframe' answers to neither.
//
// target and rel are set here, not left to the anchor hook above, so the link
// never depends on whether DOMPurify revisits a node inserted mid-traversal.
// (It does today, which is also why an embed inside <svg> disappears rather than
// degrading: the namespace check drops an HTML <a> in SVG content. That markup
// reaches no editor path, and the alternative is an SVG-namespaced anchor the
// 'A' hook cannot see — an unguarded link is worse than a lost one.)
purifier.addHook('uponSanitizeElement', (node, data) => {
	if (data.tagName !== 'iframe') return
	const frame = node as Element
	const href = embedUrl(frame.getAttribute?.('src') ?? null)
	if (!href) return
	const link = frame.ownerDocument.createElement('a')
	link.setAttribute('href', href)
	link.setAttribute('target', '_blank')
	link.setAttribute('rel', 'noopener noreferrer')
	link.textContent = href
	frame.replaceWith(link)
})

export const SAFE_HTML_LEVELS = {
	// Denylist: rich author content renders as written, minus anything that can
	// build a phishing form.
	rich: {
		FORBID_TAGS: [
			'form',
			'input',
			'button',
			'textarea',
			'select',
			'option',
			'label',
			'fieldset',
		],
		FORBID_ATTR: ['formaction', 'formmethod', 'formenctype'],
	},
	basic: {
		ALLOWED_TAGS: [
			'b',
			'br',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'i',
			'em',
			'strong',
			'a',
			'p',
			'ul',
			'ol',
			'li',
			'img',
			'blockquote',
		],
		ALLOWED_ATTR: ['href', 'target', 'src'],
	},
	bio: {
		ALLOWED_TAGS: [
			'b',
			'i',
			'em',
			'strong',
			'a',
			'p',
			'br',
			'ul',
			'ol',
			'li',
			'img',
		],
		ALLOWED_ATTR: ['href', 'target', 'rel', 'src'],
	},
} satisfies Record<string, Config>

export type SafeHtmlLevel = keyof typeof SAFE_HTML_LEVELS

// An unknown or absent level renders at the strictest profile. Too strict is a
// visible rendering bug someone reports; too loose is an XSS nobody sees.
export const sanitizeAt = (
	level: string | undefined,
	html?: string | null
): string => {
	if (!html) return ''
	const known = level && level in SAFE_HTML_LEVELS
	if (!known && import.meta.env.DEV) {
		console.warn(
			`[v-safe-html] level "${level ?? '(none)'}" is not one of ` +
				`${Object.keys(SAFE_HTML_LEVELS).join(', ')} — falling back to "bio"`
		)
	}
	const config = SAFE_HTML_LEVELS[(known ? level : 'bio') as SafeHtmlLevel]
	return purifier.sanitize(html, config)
}
