import DOMPurify from 'dompurify'

// Render-side sanitizer for v-html sinks. Server-side sanitize_html already
// strips <script>/<style>/on* handlers; this is defense-in-depth that also drops
// interactive form elements so user-authored content cannot render phishing
// forms. Unlike sanitizeHTML (allowlist, for short title/bio fields) this keeps
// all presentational HTML — div/span/class/style/tables/code — so rich
// descriptions render unchanged.
//
// Kept in its own lean module (only pulls in DOMPurify) so it stays
// importable/testable without index.js's heavy EditorJS/frappe-ui import chain.


const purifier = DOMPurify()

// Force every rendered anchor to open in a new tab with safe rel attributes.
// EditorJS's built-in link inline tool creates bare <a href> anchors via
// document.execCommand('createLink'), and DOMPurify strips `target` by default.
// Together that means lesson/quiz/assignment hyperlinks navigate away in the 
// current tab — students lose their context.
purifier.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A') {
		node.setAttribute('target', '_blank')
		node.setAttribute('rel', 'noopener noreferrer')
	}
})

export const sanitizeRichHTML = (html?: string | null): string => {
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
