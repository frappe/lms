/**
 * When a debounced search is allowed to reach the server.
 *
 * frappe-ui's `debounce` (>= 1.0.0-beta.65) returns a function with
 * `.cancel()`, and the palette calls it whenever the search is invalidated —
 * closing, unmounting, leaving a category — so a scheduled call never reaches
 * the tick at all. This file holds the pending call rather than timing it, so
 * a test decides when the trailing tick would have landed, and can assert it
 * was cancelled instead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
	clickItem,
	mountPalette,
	paletteInput,
	keydown,
	type,
	unmountPalette,
} from './helpers/commandPalette'

const resource = {
	submit: vi.fn(async () => []),
}

// The one pending tick, held until a test fires it.
let tick: (() => void) | null = null

vi.mock('frappe-ui', () => ({
	createResource: () => resource,
	debounce: (fn: () => void) => {
		const armed = () => {
			tick = fn
		}
		armed.cancel = () => {
			tick = null
		}
		return armed
	},
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { data: { is_moderator: true } } }),
}))

vi.mock('@/utils', () => ({
	getSidebarLinks: () => [{ items: [{ to: 'Courses' }, { to: 'Batches' }] }],
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		isSettingsOpen: false,
		isSettingsMounted: false,
		sidebarSettings: { data: null },
		loadSidebarSettings: vi.fn(async () => null),
	}),
}))

vi.stubGlobal('__', (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: string[]) =>
			message.replace(
				/{(\d+)}/g,
				(match, index) => args[Number(index)] ?? match
			),
	}
})

afterEach(unmountPalette)

beforeEach(() => {
	tick = null
	resource.submit = vi.fn(async () => [])
})

describe('a scheduled search', () => {
	it('runs when nothing has invalidated it', async () => {
		await mountPalette()
		await type('kub')

		tick!()
		await nextTick()

		expect(resource.submit).toHaveBeenCalledWith({ query: 'kub' })
	})

	it('does not reach the server after the palette closes', async () => {
		const wrapper = await mountPalette()
		await type('kub')

		await wrapper.setProps({ modelValue: false })
		await nextTick()

		// Cancelled outright, not merely disarmed — there is no tick left to fire.
		expect(tick).toBeNull()
		expect(resource.submit).not.toHaveBeenCalled()
	})

	it('does not reach the server after the palette unmounts', async () => {
		const wrapper = await mountPalette()
		await type('kub')

		wrapper.unmount()

		expect(tick).toBeNull()
		expect(resource.submit).not.toHaveBeenCalled()
	})

	it('does not search the category the user has backed out of', async () => {
		await mountPalette()
		await clickItem((item) => item.title === 'Courses')
		await type('kub')

		await keydown(paletteInput(), 'Escape')

		expect(tick).toBeNull()
		expect(resource.submit).not.toHaveBeenCalled()
	})
})
