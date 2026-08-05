/**
 * The command palette's shortcut hints.
 *
 * `lucide-*` are mask classes that the icon plugin paints with
 * `background-color: currentColor`. Putting `bg-surface-gray-2` on the icon to
 * give it a chip therefore repaints the glyph itself light grey and draws no
 * chip at all, which is how the arrows went nearly invisible. The chip has to
 * be a wrapper, and that is only visible in the classes.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	createResource: () => ({ data: [], reload: vi.fn() }),
	debounce: (fn: () => void) => fn,
	Dialog: Object.assign(
		{
			props: ['open', 'size', 'bare'],
			template: `<div data-testid="dialog"><slot /></div>`,
		},
		{ Title: { template: `<div data-testid="dialog-title"><slot /></div>` } }
	),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/components/CommandPalette/CommandPaletteGroup.vue', () => ({
	default: { props: ['list'], template: `<div />` },
}))

vi.stubGlobal('__', (text: string) => text)

import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'

const build = () =>
	mount(CommandPalette, {
		props: { modelValue: true },
		global: { mocks: { __: (text: string) => text } },
	})

describe('CommandPalette', () => {
	it('never paints a lucide glyph with a surface colour', () => {
		for (const icon of build().findAll('[class*="lucide-"]')) {
			expect(icon.classes().join(' ')).not.toMatch(/\bbg-surface-/)
		}
	})

	it('draws each shortcut hint as a chip around its icon', () => {
		const wrapper = build()

		const chips = wrapper.findAll('.bg-surface-gray-2')
		expect(chips.length).toBeGreaterThan(0)
		for (const chip of chips) {
			expect(chip.classes()).not.toContain(
				chip.classes().find((c) => c.startsWith('lucide-'))
			)
		}
	})

	// reka's DialogContent warns without one, and `bare` drops the auto-header.
	it('names the dialog for screen readers', () => {
		expect(build().find('[data-testid="dialog-title"]').exists()).toBe(true)
	})
})
