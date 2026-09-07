/**
 * When a debounced search is allowed to reach the server.
 *
 * frappe-ui's `debounce` returns a bare function with no `.cancel()`, so a call
 * already scheduled cannot be cleared — the palette disarms it instead, and
 * these cases are what that has to cover. This file holds the pending call
 * rather than timing it, so a test decides when the trailing tick lands, and
 * whether anything is still interested by then.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const resource = {
	submit: vi.fn(async () => []),
}

// The one pending tick, held until a test fires it.
let tick: (() => void) | null = null

vi.mock('frappe-ui', () => ({
	createResource: () => resource,
	debounce: (fn: () => void) => () => {
		tick = fn
	},
	Dialog: Object.assign(
		{ props: ['open', 'size', 'bare'], template: `<div><slot /></div>` },
		{ Title: { template: `<div><slot /></div>` } }
	),
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/components/CommandPalette/CommandPaletteGroup.vue', () => ({
	default: { name: 'PaletteGroup', props: ['list'], template: `<div />` },
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

import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'

const build = () =>
	mount(CommandPalette, {
		props: { modelValue: true },
		global: { mocks: { __: (globalThis as any).__ } },
	})

function rows(wrapper: ReturnType<typeof build>) {
	const list = wrapper
		.findComponent({ name: 'PaletteGroup' })
		.props('list') as any[]
	return list.flatMap((group) => group.items)
}

function press(wrapper: ReturnType<typeof build>, key: string) {
	return wrapper.find('input').trigger('keydown', { key })
}

/** Types `text`, which arms the tick but does not fire it. */
async function type(wrapper: ReturnType<typeof build>, text: string) {
	const input = wrapper.find('input')
	await input.setValue(text)
	await input.trigger('input')
	await nextTick()
}

/** Arrows onto the row with `title` and opens it. */
async function open(wrapper: ReturnType<typeof build>, title: string) {
	const index = rows(wrapper).findIndex((item) => item.title === title)
	expect(index).toBeGreaterThanOrEqual(0)
	for (let i = 0; i <= index; i++) await press(wrapper, 'ArrowDown')
	await press(wrapper, 'Enter')
	await nextTick()
}

beforeEach(() => {
	tick = null
	resource.submit = vi.fn(async () => [])
})

describe('a scheduled search', () => {
	it('runs when nothing has invalidated it', async () => {
		const wrapper = build()
		await type(wrapper, 'kub')

		tick!()
		await nextTick()

		expect(resource.submit).toHaveBeenCalledWith({ query: 'kub' })
	})

	it('does not reach the server after the palette closes', async () => {
		const wrapper = build()
		await type(wrapper, 'kub')

		await wrapper.setProps({ modelValue: false })
		await nextTick()
		tick!()
		await nextTick()

		expect(resource.submit).not.toHaveBeenCalled()
	})

	it('does not reach the server after the palette unmounts', async () => {
		const wrapper = build()
		await type(wrapper, 'kub')

		wrapper.unmount()
		tick!()
		await nextTick()

		expect(resource.submit).not.toHaveBeenCalled()
	})

	it('does not search the category the user has backed out of', async () => {
		const wrapper = build()
		await open(wrapper, 'Courses')
		await type(wrapper, 'kub')

		await press(wrapper, 'Escape')
		await nextTick()
		tick!()
		await nextTick()

		expect(resource.submit).not.toHaveBeenCalled()
	})
})
