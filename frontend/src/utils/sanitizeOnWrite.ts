import DOMPurify from 'dompurify'

// Sanitizer for values about to be PERSISTED. Security-only, never editorial:
// what this strips is gone forever, so it may only remove things that are
// unsafe, never things that are merely unwanted at some render site. Rendering
// strictness is a reversible policy choice and belongs in v-safe-html levels.
//
// Its own DOMPurify instance, not sanitizeRichHTML's: hooks are registered per
// instance, and that one forces target/rel onto every anchor, which is a render
// decision that must not be written into stored content.
const purifier = DOMPurify()

export const sanitizeOnWrite = (html?: string | null): string => {
	if (!html) return ''
	return purifier.sanitize(html, {
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
	})
}
