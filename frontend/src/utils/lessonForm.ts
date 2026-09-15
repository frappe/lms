interface EditorJsBlock {
	type?: string
	data?: Record<string, unknown>
}

interface EditorJsOutput {
	blocks?: EditorJsBlock[]
}

/**
 * True when an EditorJS save payload has at least one block with real content.
 * An empty paragraph (or a block with no data) does not count.
 *
 * This is the guard that stops a transient/empty editor from wiping a lesson:
 * a hot-reload remount, a render race, or mid lesson-switch can leave the editor
 * holding only EditorJS's default empty paragraph. Persisting that would
 * overwrite stored content with a blank doc, so `saveLesson` refuses when this
 * returns false.
 */
export function hasEditorContent(output?: EditorJsOutput | null): boolean {
	const blocks = output?.blocks
	if (!Array.isArray(blocks)) return false
	return blocks.some((block) => {
		const data = block?.data
		if (!data || Object.keys(data).length === 0) return false
		if (block.type === 'paragraph') {
			return Boolean(String(data.text ?? '').trim())
		}
		return true
	})
}

/**
 * True when a lesson has instructor notes worth flagging: either legacy
 * markdown (`instructor_notes`) or EditorJS JSON (`instructor_content`) with at
 * least one non-empty block. An empty paragraph does not count.
 */
export function hasInstructorContent(
	instructorContent?: string | null,
	legacyNotes?: string | null
): boolean {
	if (legacyNotes && legacyNotes.trim()) return true
	if (!instructorContent) return false
	try {
		return hasEditorContent(JSON.parse(instructorContent) as EditorJsOutput)
	} catch {
		return false
	}
}

/**
 * Autosave is a no-op when a lesson is entirely empty: no title and no body.
 * Content on its own is optional, so a title-only lesson still saves; skipping
 * the empty case avoids erroring on the required-title validation.
 */
export function shouldSkipLessonSave(
	title: string | null | undefined,
	hasBodyContent: boolean
): boolean {
	return !title?.trim() && !hasBodyContent
}

/**
 * A lesson title is one line. The field is a `<textarea>` so a long title can
 * wrap and grow, but Enter is refused, and a title pasted (or already stored)
 * with breaks in it collapses to spaces rather than rendering as two lines the
 * outline and breadcrumbs then show as one.
 */
export function toSingleLineTitle(title: string | null | undefined): string {
	if (!title) return ''
	return title.replace(/\s*[\r\n]+\s*/g, ' ')
}

// Rows written before `content` carried `ignore_xss_filter` were mangled by nh3
// reading the JSON as markup: `href=\"x\"` came back `href="\&quot;x\&quot;"`, and
// every `<a>` gained a bare-quoted `rel`. Every typed character survives, so the
// row repairs in place.
const SANITISER_ARTEFACTS: Array<[RegExp, string]> = [
	[/="\\&quot;(.*?)\\&quot;"/g, '=\\"$1\\"'],
	[/ rel="noopener noreferrer"/g, ' rel=\\"noopener noreferrer\\"'],
]

/**
 * Undo those two artefacts, and only those two. Anything else that fails to
 * parse is genuinely malformed and must keep failing, so the read-only guard
 * still protects it.
 */
function repairSanitizedEditorJs(raw: string): EditorJsOutput | null {
	const repaired = SANITISER_ARTEFACTS.reduce(
		(text, [pattern, replacement]) => text.replace(pattern, replacement),
		raw
	)
	if (repaired === raw) return null
	try {
		const parsed = JSON.parse(repaired)
		return parsed && typeof parsed === 'object'
			? (parsed as EditorJsOutput)
			: null
	} catch {
		return null
	}
}

/**
 * Parse a stored EditorJS payload, repairing the sanitiser damage above. Null
 * means unreadable, never absent: callers check for empty first, and an empty
 * editor serialised back over the row is how a lesson gets destroyed.
 */
export function parseStoredEditorJs(
	raw?: string | null
): EditorJsOutput | null {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw)
		return parsed && typeof parsed === 'object'
			? (parsed as EditorJsOutput)
			: null
	} catch {
		return repairSanitizedEditorJs(raw)
	}
}
