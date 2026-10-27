// Regression: an unknown block showed EditorJS's stub with the internal type name
// ("Programming_exercise") to learners (#3019, fixed in #3041).
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorJS from '@editorjs/editorjs'
import Paragraph from '@editorjs/paragraph'

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text
// Importing '@/utils' loads plyr, which needs window.matchMedia that jsdom lacks.
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

const { getEditorTools } = await import('@/utils')

const unknownBlock = {
	id: 'b2',
	type: 'programming_exercise',
	data: { exercise: 'EX-1' },
}

const editors: EditorJS[] = []

async function renderLesson(readOnly: boolean) {
	// EditorJS warns that it has no tool for the type before falling back.
	vi.spyOn(console, 'warn').mockImplementation(() => {})
	const holder = document.createElement('div')
	document.body.appendChild(holder)
	const { stub } = getEditorTools() as Record<string, unknown>
	const editor = new EditorJS({
		holder,
		readOnly,
		tools: { paragraph: Paragraph, ...(stub ? { stub } : {}) } as never,
		data: {
			blocks: [
				{ id: 'b1', type: 'paragraph', data: { text: 'Intro' } },
				unknownBlock,
			],
		},
	})
	editors.push(editor)
	await editor.isReady
	await new Promise((resolve) => setTimeout(resolve, 50))
	return { editor, holder }
}

describe('an unknown lesson block', () => {
	afterEach(() => {
		editors.splice(0).forEach((editor) => editor.destroy())
		document.body.innerHTML = ''
	})

	it('shows a neutral note without the internal type name', async () => {
		const { holder } = await renderLesson(true)

		expect(holder.textContent).toContain('Intro')
		expect(holder.textContent).toContain('This content is not available')
		expect(holder.textContent?.toLowerCase()).not.toContain(
			'programming_exercise'
		)
		expect(holder.textContent).not.toContain('can not be displayed')
	})

	it('keeps the original block when the lesson is saved', async () => {
		const { editor } = await renderLesson(false)

		const { blocks } = await editor.save()

		expect(blocks[1]).toEqual(unknownBlock)
	})
})
