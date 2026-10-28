import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	if (!window.matchMedia)
		Object.assign(window, {
			matchMedia: () => ({
				matches: false,
				addEventListener: () => {},
				removeEventListener: () => {},
			}),
		})
})

import { isLessonSelection } from '@/utils/lessonSelection'
import { highlightText } from '@/utils'

const lesson = () => {
	document.body.innerHTML = `
		<div id="editor">
			<p id="text">Lists keep their order, tuples cannot change.</p>
			<div data-assessment-block>
				<p id="block">Pick the tuples cannot change answer.</p>
			</div>
			<p id="more">A tuples cannot change rule again.</p>
		</div>
		<aside id="outside">tuples cannot change, said the sidebar.</aside>`
}

const select = (
	anchorId: string,
	anchorOffset: number,
	focusId: string,
	focusOffset: number
): Selection => {
	const selection = window.getSelection()!
	selection.removeAllRanges()
	selection.setBaseAndExtent(
		document.getElementById(anchorId)!.firstChild!,
		anchorOffset,
		document.getElementById(focusId)!.firstChild!,
		focusOffset
	)
	return selection
}

afterEach(() => {
	window.getSelection()?.removeAllRanges()
	document.body.replaceChildren()
})

// Guards Highlight and Add to Notes being offered on text inside lesson blocks.
// Notes came in #1671; broke once this branch rendered assessments inline.
// Added on feat/assessment-visual-redesign with the lesson-text-only fix.
describe('isLessonSelection', () => {
	it('accepts a selection within the lesson text', () => {
		lesson()
		expect(isLessonSelection(select('text', 0, 'text', 5))).toBe(true)
	})

	it('refuses a selection inside an assessment block', () => {
		lesson()
		expect(isLessonSelection(select('block', 0, 'block', 4))).toBe(false)
	})

	it('refuses a drag from lesson text into a block', () => {
		lesson()
		expect(isLessonSelection(select('text', 0, 'block', 4))).toBe(false)
	})

	it('refuses a drag from a block out into lesson text', () => {
		lesson()
		expect(isLessonSelection(select('block', 0, 'more', 4))).toBe(false)
	})

	it('refuses a drag across a block from one paragraph to the next', () => {
		lesson()
		expect(isLessonSelection(select('text', 0, 'more', 4))).toBe(false)
	})

	it('refuses text outside the lesson body', () => {
		lesson()
		expect(isLessonSelection(select('outside', 0, 'outside', 6))).toBe(false)
	})

	it('refuses an empty selection', () => {
		lesson()
		expect(isLessonSelection(select('text', 2, 'text', 2))).toBe(false)
	})
})

// Guards a saved highlight being re-applied inside an inline assessment block.
// highlightText came in #1671; broke once this branch rendered blocks inline.
// Added on feat/assessment-visual-redesign with the lesson-text-only fix.
describe('highlightText', () => {
	const note = {
		name: 'NOTE-1',
		color: 'Yellow',
		highlighted_text: 'tuples cannot change',
	}

	it('never highlights inside an assessment block', () => {
		lesson()
		document.getElementById('text')!.remove()

		highlightText(note)

		const highlights = document.querySelectorAll('.highlighted-text')
		expect(highlights).toHaveLength(1)
		expect(highlights[0].closest('[data-assessment-block]')).toBeNull()
		expect(highlights[0].closest('#more')).not.toBeNull()
	})

	it('highlights nothing when the phrase is only inside a block', () => {
		lesson()
		document.getElementById('text')!.remove()
		document.getElementById('more')!.remove()

		highlightText(note)

		expect(document.querySelectorAll('.highlighted-text')).toHaveLength(0)
	})
})
