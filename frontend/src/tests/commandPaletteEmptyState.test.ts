/**
 * The "No results found" message while the user keeps typing.
 *
 * This suite mocks `createResource` as a *reactive* object because the bug it
 * pins only exists when `loading` is reactive: the message was tied to
 * `search.loading`, so every keystroke's request blanked it, the results area
 * collapsed, and the dialog resized once per letter. A plain object mock cannot
 * reproduce that, which is why this file cannot merge into the other palette
 * suites — they stub the same module a different way.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

const resource: any = reactive({
	loading: false,
	submit: vi.fn(),
})
vi.mock('frappe-ui', () => ({
	createResource: () => resource,
	debounce: (fn: any) => fn,
	Dialog: Object.assign(
		{ props: ['open', 'size', 'bare'], template: `<div><slot /></div>` },
		{ Title: { template: `<div><slot /></div>` } }
	),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
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
vi.stubGlobal('__', (m: string) => (/{\d+}/.test(m) ? { format: () => m } : m))

import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'

describe('typing with no results', () => {
	it('does not claim "no results" before the first response lands', async () => {
		const wrapper = mount(CommandPalette, {
			props: { modelValue: true },
			global: { mocks: { __: (globalThis as any).__ } },
		})
		resource.submit = vi.fn(() => {
			resource.loading = true
			return new Promise(() => {})
		})
		const input = wrapper.find('input')
		await input.setValue('zz')
		await input.trigger('input')
		await nextTick()

		expect(wrapper.text()).not.toContain('No results')
	})

	it('keeps the empty message steady across keystrokes', async () => {
		const wrapper = mount(CommandPalette, {
			props: { modelValue: true },
			global: { mocks: { __: (globalThis as any).__ } },
		})
		const input = wrapper.find('input')
		const frames: string[] = []
		const snap = (label: string) =>
			frames.push(
				`${label}=${wrapper.text().includes('No results') ? 'MSG' : '---'}`
			)

		// A deliberate typist: each letter pauses long enough to fire its own request.
		let release: (v: any) => void = () => {}
		resource.submit = vi.fn(() => {
			resource.loading = true
			return new Promise((r) => {
				release = (v) => {
					resource.loading = false
					r(v)
				}
			})
		})

		for (const term of ['zz', 'zzq', 'zzqx']) {
			await input.setValue(term)
			await input.trigger('input')
			await nextTick()
			snap(`${term}:inflight`)
			release([])
			await nextTick()
			await nextTick()
			snap(`${term}:settled`)
		}
		// Once it says "no results", it must not blink off while the next
		// keystroke's request is in flight.
		expect(frames.slice(1)).not.toContain('zzq:inflight=---')
		expect(frames.slice(1)).not.toContain('zzqx:inflight=---')
	})
})
