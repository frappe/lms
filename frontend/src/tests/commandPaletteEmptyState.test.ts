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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import {
	flush,
	mountPalette,
	paletteText,
	type,
	unmountPalette,
} from './helpers/commandPalette'

const resource: any = reactive({
	loading: false,
	submit: vi.fn(),
})
vi.mock('frappe-ui', () => ({
	createResource: () => resource,
	debounce: (fn: any) => Object.assign(fn, { cancel: () => {} }),
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

afterEach(unmountPalette)

describe('typing with no results', () => {
	it('does not claim "no results" before the first response lands', async () => {
		await mountPalette()
		resource.submit = vi.fn(() => {
			resource.loading = true
			return new Promise(() => {})
		})
		await type('zz')

		expect(paletteText()).not.toContain('No results')
	})

	it('keeps the empty message steady across keystrokes', async () => {
		await mountPalette()
		const frames: string[] = []
		const snap = (label: string) =>
			frames.push(`${label}=${paletteText().includes('No results') ? 'MSG' : '---'}`)

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
			await type(term)
			snap(`${term}:inflight`)
			release([])
			await flush()
			snap(`${term}:settled`)
		}
		// Once it says "no results", it must not blink off while the next
		// keystroke's request is in flight.
		expect(frames.slice(1)).not.toContain('zzq:inflight=---')
		expect(frames.slice(1)).not.toContain('zzqx:inflight=---')
	})
})
