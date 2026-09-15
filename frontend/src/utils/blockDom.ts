import { safeUrl } from './safeUrl'

// EditorJS blocks build their own DOM outside Vue, so neither v-safe-html nor
// the bound-attribute scanners reach them: a template literal into innerHTML is
// the only sink they have, and every one of them interpolated an author-supplied
// id or title straight into markup. These two build the same output through the
// DOM, where a value is data and cannot close an attribute.

// Returns nothing when the URL fails the scheme allowlist, so the caller renders
// no frame at all — an <iframe src=""> resolves to the current page and would
// load the whole SPA inside itself.
export const embedFrame = (
	src: string | null | undefined,
	attrs: Record<string, string>
): HTMLIFrameElement | undefined => {
	const href = safeUrl(src)
	if (!href) return undefined
	const frame = document.createElement('iframe')
	frame.setAttribute('src', href)
	for (const [name, value] of Object.entries(attrs))
		frame.setAttribute(name, value)
	return frame
}

// The "Assignment: <title>" placeholder every non-readOnly block renders.
export const blockNotice = (text: string): HTMLDivElement => {
	const card = document.createElement('div')
	card.className = 'border rounded-md p-4 text-center bg-surface-sidebar mb-4'
	const label = document.createElement('span')
	label.className = 'font-medium'
	label.textContent = text
	card.append(label)
	return card
}
