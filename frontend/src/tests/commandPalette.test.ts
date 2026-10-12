/**
 * The command palette's shortcut hints.
 *
 * `lucide-*` are mask classes that the icon plugin paints with
 * `background-color: currentColor`. Putting `bg-surface-gray-2` on the icon to
 * give it a chip therefore repaints the glyph itself light grey and draws no
 * chip at all, which is how the arrows went nearly invisible. The chip has to
 * be a wrapper, and that is only visible in the classes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountPalette, paletteText, unmountPalette } from './helpers/commandPalette'

vi.mock('frappe-ui', () => ({
	createResource: () => ({ data: [], submit: vi.fn(async () => []) }),
	debounce: (fn: () => void) => Object.assign(fn, { cancel: () => {} }),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// The palette reads roles to decide which category rows to show, and the
// settings store to decide whether the Settings row can do anything.
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { data: { is_moderator: true } } }),
}))
vi.mock('@/utils', () => ({
	getSidebarLinks: () => [
		{
			items: [
				{ to: 'Courses' },
				{ to: 'Batches' },
				{ to: 'Programs' },
				{ to: 'Jobs' },
				{ to: 'Quizzes' },
				{ to: 'Assignments' },
			],
		},
	],
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		isSettingsOpen: false,
		isSettingsMounted: true,
		// The palette filters its rows by these flags as well as by the sidebar.
		sidebarSettings: { data: null },
		loadSidebarSettings: vi.fn(async () => null),
	}),
}))

vi.stubGlobal('__', (text: string) => text)

afterEach(unmountPalette)

describe('CommandPalette', () => {
	it('never paints a lucide glyph with a surface colour', async () => {
		await mountPalette()
		for (const icon of Array.from(
			document.body.querySelectorAll('[class*="lucide-"]')
		)) {
			expect(icon.className).not.toMatch(/\bbg-surface-/)
		}
	})

	it('draws each shortcut hint as a chip around its icon', async () => {
		await mountPalette()
		const chips = Array.from(
			document.body.querySelectorAll('.bg-surface-gray-2')
		)
		expect(chips.length).toBeGreaterThan(0)
		for (const chip of chips) {
			const classes = Array.from(chip.classList)
			expect(classes).not.toContain(
				classes.find((c) => c.startsWith('lucide-'))
			)
		}
	})

	// reka's DialogContent warns without one, and `bare` drops the auto-header.
	it('names the dialog for screen readers', async () => {
		await mountPalette()
		expect(paletteText()).toContain('Command palette')
	})
})
