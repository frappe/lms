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
 * True when a lesson has instructor notes worth flagging — either legacy
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
 * Autosave is a no-op when a lesson is entirely empty — no title and no body.
 * Content on its own is optional, so a title-only lesson still saves; skipping
 * the empty case avoids erroring on the required-title validation.
 */
export function shouldSkipLessonSave(
	title: string | null | undefined,
	hasBodyContent: boolean
): boolean {
	return !title?.trim() && !hasBodyContent
}
