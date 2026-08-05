/**
 * Settings > Users pages through lms.lms.api.get_members rather than a list
 * resource, so its search and paging correctness is its own: the term has to
 * reach the server, the offset has to go back to zero, and a response has to be
 * dropped once the query it was issued for is gone.
 *
 * The mock resolves reload() from a queue the test controls, so two requests
 * can be held open at once and landed in either order.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'

const { paramsSeen, pending } = vi.hoisted(() => ({
	paramsSeen: [] as any[],
	pending: [] as Array<(rows: any[]) => void>,
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(() => Promise.resolve()),
	// reload() returns the rows, because Members awaits it and token-checks the
	// result. A mock that returned undefined would make every paging assertion
	// below pass without the component ever appending anything.
	createResource: (options: any) => ({
		loading: false,
		reload: () => {
			paramsSeen.push(options.makeParams())
			return new Promise((resolve) => pending.push(resolve as any))
		},
		submit: vi.fn(),
	}),
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: { template: '<div />' },
	Select: { template: '<select />' },
}))

vi.mock('frappe-ui/frappe', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/utils', () => ({
	cleanError: (e: unknown) => e,
	openSettings: vi.fn(),
}))

vi.stubGlobal('__', (text: string) => text)

import Members from '@/components/Settings/Members.vue'
import { SETTINGS_PAGE_LENGTH } from '@/composables/useSettingsListResource'

const rows = (count: number, prefix = 'user') =>
	Array.from({ length: count }, (_, i) => ({ name: `${prefix}${i}@x.com` }))

/** Lands the oldest outstanding request with `data`. */
const land = async (data: any[]) => {
	pending.shift()?.(data)
	await flushPromises()
}

const mountMembers = () =>
	shallowMount(Members, {
		props: { label: 'Users', description: '' },
		global: {
			provide: { $user: { data: { is_system_manager: true } } },
			mocks: { __: (text: string) => text },
		},
	})

describe('Settings > Users search', () => {
	beforeEach(() => {
		paramsSeen.length = 0
		pending.length = 0
	})

	it('fetches the first page on mount', () => {
		mountMembers()

		expect(paramsSeen.at(-1)).toMatchObject({ start: 0, search: '' })
	})

	it('sends the term to the server', async () => {
		const vm = mountMembers().vm as any

		vm.search = 'ada'
		await flushPromises()

		expect(paramsSeen.at(-1)).toMatchObject({ search: 'ada', start: 0 })
	})

	it('restarts at the first page when searching after Load More', async () => {
		const vm = mountMembers().vm as any
		await land(rows(SETTINGS_PAGE_LENGTH))
		expect(vm.start).toBe(SETTINGS_PAGE_LENGTH)

		vm.search = 'ada'
		await flushPromises()

		expect(paramsSeen.at(-1).start).toBe(0)
	})

	it('drops the rows it had before re-querying', async () => {
		const vm = mountMembers().vm as any
		await land(rows(3))
		expect(vm.memberList).toHaveLength(3)

		vm.search = 'ada'
		await flushPromises()

		expect(vm.memberList).toEqual([])
	})

	// The header and every row are separate grid containers sharing one grid
	// template, so a content-sized track resolves independently in each. This
	// column carried `width: 'auto'` and put the Roles header ~300px right of
	// the badges it labelled.
	it('sizes every column identically in the header and the rows', () => {
		const columns = mountMembers()
			.findComponent({ name: 'SettingsList' })
			.props('columns') as { width?: string }[]

		for (const column of columns) {
			expect(column.width ?? '').not.toMatch(/auto|max-content|min-content/)
		}
	})

	it('offers Load More only on a full page', async () => {
		const vm = mountMembers().vm as any

		await land(rows(SETTINGS_PAGE_LENGTH - 1))

		expect(vm.hasNextPage).toBe(false)
	})

	// Load More vanished from Users when the server paged at a different size
	// than the client constant: an exact-equality check reads a full page as a
	// last page. A full page is a full page whatever its size.
	it('keeps Load More when the server pages larger than the constant', async () => {
		const vm = mountMembers().vm as any

		await land(rows(SETTINGS_PAGE_LENGTH + 7))

		expect(vm.hasNextPage).toBe(true)
	})

	it('pages by the rows returned, not by the constant', async () => {
		const vm = mountMembers().vm as any

		await land(rows(SETTINGS_PAGE_LENGTH + 7))

		expect(vm.start).toBe(SETTINGS_PAGE_LENGTH + 7)
	})

	it('appends the next page onto the rows already shown', async () => {
		const vm = mountMembers().vm as any
		await land(rows(SETTINGS_PAGE_LENGTH, 'first'))

		vm.fetchMembers()
		await land(rows(4, 'second'))

		expect(vm.memberList).toHaveLength(SETTINGS_PAGE_LENGTH + 4)
		expect(vm.start).toBe(SETTINGS_PAGE_LENGTH + 4)
	})

	// createResource aborts nothing and carries no sequence number, so both
	// responses to a mid-flight filter change used to resolve and both append:
	// one filter's page under another's, with `start` advanced past rows nobody
	// ever saw.
	it('drops a response whose query has already been replaced', async () => {
		const vm = mountMembers().vm as any
		await land(rows(3, 'initial'))

		vm.currentRole = 'Moderator'
		await flushPromises()
		vm.currentRole = 'Course Creator'
		await flushPromises()

		// The Moderator page lands after the Instructor query was issued.
		await land(rows(SETTINGS_PAGE_LENGTH, 'moderator'))
		await land(rows(2, 'instructor'))

		expect(vm.memberList).toHaveLength(2)
		expect(
			vm.memberList.every((m: any) => m.name.startsWith('instructor'))
		).toBe(true)
		expect(vm.start).toBe(2)
	})
})
