import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import {
	MAX_HEIGHT,
	MIN_HEIGHT,
	boxClass,
	contentClass,
	toolbarClass,
} from '@/components/richTextEditorClasses'

vi.stubGlobal('__', (text: string): string => text)
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia
document.elementFromPoint ??= () => null

vi.mock('frappe-ui', async (orig) => ({
	...(await orig<typeof import('frappe-ui')>()),
	useFileUpload: () => ({ upload: vi.fn() }),
}))

const { default: RichTextEditor } = await import(
	'@/components/RichTextEditor.vue'
)

const tokens = (classes: string | string[]): string[] =>
	[classes].flat().join(' ').split(' ').filter(Boolean)

describe('RichTextEditor class map', () => {
	it('draws one bordered box for outline, with its hover and focus states', () => {
		expect(tokens(boxClass('outline', false, false))).toEqual(
			expect.arrayContaining([
				'rounded-5',
				'border',
				'border-outline-gray-2',
				'hover:border-outline-gray-3',
				'focus-within:border-outline-gray-4',
				'focus-within:shadow-sm',
			])
		)
	})

	it('fills subtle grey and lifts it to the base surface on focus', () => {
		expect(tokens(boxClass('subtle', false, false))).toEqual(
			expect.arrayContaining([
				'rounded-5',
				'bg-surface-gray-2',
				'focus-within:bg-surface-base',
			])
		)
	})

	it('swaps the grey border for red when invalid, never both', () => {
		for (const variant of ['outline', 'subtle'] as const) {
			const box = tokens(boxClass(variant, true, false))
			expect(box).toContain('border-outline-red-3')
			expect(box).toContain('focus-within:border-outline-red-4')
			expect(box.some((c) => c.includes('outline-gray'))).toBe(false)
		}
	})

	it('gives ghost no chrome at all', () => {
		expect(tokens(boxClass('ghost', false, false))).toEqual([])
		expect(tokens(boxClass('ghost', true, false))).toEqual([])
		expect(tokens(contentClass('ghost', null, null, false))).toEqual([])
		expect(toolbarClass('ghost')).not.toMatch(/\bborder/)
	})

	it('separates the toolbar from the content with a bottom hairline only', () => {
		const bar = tokens(toolbarClass('outline'))
		expect(bar).toContain('border-b')
		expect(bar).not.toContain('border')
		expect(bar.some((c) => c.startsWith('rounded'))).toBe(false)
	})

	it('maps every height key to a literal class, and scrolls under a ceiling', () => {
		for (const [key, cls] of Object.entries(MIN_HEIGHT))
			expect(cls).toBe(`min-h-[${key}]`)
		for (const [key, cls] of Object.entries(MAX_HEIGHT))
			expect(cls).toBe(`max-h-[${key}] overflow-y-auto`)
		expect(tokens(contentClass('outline', '7rem', '18rem', false))).toEqual([
			'px-2',
			'py-1',
			'min-h-[7rem]',
			'max-h-[18rem]',
			'overflow-y-auto',
		])
	})

	it('lets a filled box hand its height to the content', () => {
		expect(tokens(boxClass('outline', false, true))).toEqual(
			expect.arrayContaining(['flex', 'flex-1', 'flex-col'])
		)
		expect(tokens(contentClass('outline', '6rem', null, true))).toEqual(
			expect.arrayContaining(['flex-1', 'overflow-y-auto', 'min-h-[6rem]'])
		)
	})
})

let wrapper: VueWrapper | null = null

afterEach(() => {
	wrapper?.unmount()
	wrapper = null
})

describe('RichTextEditor chrome', () => {
	const mountEditor = async (props: Record<string, unknown>) => {
		wrapper = mount(RichTextEditor, { props, attachTo: document.body })
		await flushPromises()
		return wrapper
	}

	it('puts the toolbar and content inside one box with no border of their own', async () => {
		const w = await mountEditor({ fixedMenu: true, minHeight: '7rem' })
		const box = w.get('[data-testid="rich-text-editor"]')
		expect(box.classes()).toEqual(
			expect.arrayContaining(['rounded-5', 'border'])
		)

		const menu = box.get('[data-slot="fixed-menu"]')
		expect(menu.classes()).toContain('border-b')
		expect(menu.classes()).not.toContain('border')

		const content = box.get('[data-slot="editor-content"]')
		expect(content.classes()).toEqual(
			expect.arrayContaining(['prose-sm', 'min-h-[7rem]', 'px-2'])
		)
		expect(content.classes()).not.toContain('border')
	})

	it('turns the box red off ariaInvalid', async () => {
		const w = await mountEditor({ ariaInvalid: true })
		const box = w.get('[data-testid="rich-text-editor"]')
		expect(box.classes()).toContain('border-outline-red-3')
		expect(
			w.get('[data-slot="editor-content"]').attributes('aria-invalid')
		).toBe('true')
	})

	it('drops the box for ghost', async () => {
		const w = await mountEditor({ variant: 'ghost', minHeight: '200px' })
		const box = w.get('[data-testid="rich-text-editor"]')
		expect(box.classes()).toEqual([])
		expect(w.get('[data-slot="editor-content"]').classes()).toContain(
			'min-h-[200px]'
		)
	})
})
