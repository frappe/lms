import Header from '@editorjs/header'
import type { HeaderData } from '@editorjs/header'

/**
 * A heading is one line. EditorJS's Enter handler returns early on Shift+Enter
 * (`BlockEvents.enter`), so the browser's default runs and drops a `<br>` into
 * the contenteditable. The header tool's sanitize config allows no `<br>`
 * (unlike paragraph's), so the break is stripped on save and the two lines are
 * glued into one word — the editor shows a multi-line heading that silently
 * collapses on reload. Refuse the break instead of losing text.
 */
export class Heading extends Header {
	// Bound in getTag(), not render(): changing the heading level rebuilds the
	// element (Header's `data` setter swaps the node), which would drop a
	// listener attached once at render time.
	getTag(): HTMLElement {
		const tag = super.getTag()
		flattenLineBreaks(tag)
		tag.addEventListener('keydown', refuseLineBreak)
		return tag
	}

	// Backspace at the start of a paragraph merges it into the heading above,
	// carrying that paragraph's line breaks with it.
	merge(data: Partial<HeaderData>): void {
		super.merge({ ...data, text: stripLineBreaks(data.text ?? '') })
	}
}

function refuseLineBreak(event: KeyboardEvent): void {
	// Plain Enter still splits the block — that stays EditorJS's to handle.
	if (event.key === 'Enter' && event.shiftKey) {
		event.preventDefault()
	}
}

function stripLineBreaks(html: string): string {
	return html.replace(/<br\s*\/?>/gi, ' ')
}

// Content written before this guard — or imported from markdown — can still
// arrive with breaks in it.
function flattenLineBreaks(tag: HTMLElement): void {
	tag.querySelectorAll('br').forEach((br) => br.replaceWith(' '))
}
