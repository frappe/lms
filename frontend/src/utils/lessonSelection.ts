import { ASSESSMENT_BLOCK_SELECTOR } from '@/utils/blockMount'

// The lesson body EditorJS renders into (Lesson.vue's `#editor`).
const LESSON_BODY_SELECTOR = '#editor'

const elementOf = (node: Node | null): Element | null =>
	node instanceof Element ? node : node?.parentElement ?? null

const isLessonText = (node: Node | null): boolean => {
	const element = elementOf(node)
	if (!element?.closest(LESSON_BODY_SELECTOR)) return false
	return !element.closest(ASSESSMENT_BLOCK_SELECTOR)
}

const crossesABlock = (range: Range): boolean =>
	Array.from(document.querySelectorAll(ASSESSMENT_BLOCK_SELECTOR)).some(
		(block) => range.intersectsNode(block)
	)

// Highlights and notes are for the lesson's own text. A selection counts only
// when both of its ends are in the lesson body, outside every assessment
// block, and it does not run through a block on the way.
export function isLessonSelection(selection: Selection | null): boolean {
	if (!selection?.rangeCount || !selection.toString()) return false
	if (!isLessonText(selection.anchorNode)) return false
	if (!isLessonText(selection.focusNode)) return false
	return !crossesABlock(selection.getRangeAt(0))
}
