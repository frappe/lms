// rc.1's TextInput emits update:modelValue on input and on change, so a search
// box reloading on that event fetched twice per typed value. Each page must
// reload its list once per value.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const { reloads } = vi.hoisted(() => ({
	reloads: { current: {} as Record<string, number> },
}))

const count = (key: string) => {
	reloads.current[key] = (reloads.current[key] || 0) + 1
}

vi.mock('frappe-ui', () => {
	const resource = (key: string) =>
		reactive({
			data: null as unknown,
			hasNextPage: false,
			pageLength: 24,
			list: { loading: false },
			update: () => {},
			reload: () => {
				count(key)
				return Promise.resolve([])
			},
			submit: () => count(key),
			abort: () => {},
			next: () => {},
		})
	return {
		usePageMeta: () => {},
		call: () => Promise.resolve(0),
		toast: { error: () => {}, success: () => {} },
		createListResource: (options: { url?: string; doctype: string }) =>
			resource(options.url || options.doctype),
		createResource: (options: { url: string }) => resource(options.url),
		Badge: { template: '<span><slot /></span>' },
		Button: { template: '<button><slot /></button>' },
		Dropdown: { template: '<div><slot :open="false" /></div>' },
		TabButtons: { props: ['options', 'modelValue'], template: '<div />' },
		FormControl: {
			inheritAttrs: false,
			props: ['modelValue', 'type'],
			emits: ['update:modelValue'],
			template: `<input
				v-bind="$attrs"
				data-testid="search"
				:value="modelValue"
				@input="$emit('update:modelValue', $event.target.value)"
				@change="$emit('update:modelValue', $event.target.value)"
			/>`,
		},
	}
})

const stub = (template = '<div />') => ({ default: { template } })
vi.mock('@/components/Controls/Link.vue', () => stub())
vi.mock('@/components/Controls/Select.vue', () => stub())
vi.mock('@/components/Controls/ClearableCombobox.vue', () => stub())
vi.mock('@/components/Controls/ToggleFilter.vue', () => stub())
vi.mock('@/components/JobCard.vue', () => stub())
vi.mock('@/components/UserAvatar.vue', () => stub())
vi.mock('@/pages/Batches/components/BatchCard.vue', () => stub())
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: { template: '<div><slot name="filters" /></div>' },
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))
vi.mock('@/composables/useFormRoute', () => ({ openFormRoute: () => {} }))
vi.mock('@/utils/routes', () => ({ profileRoute: () => ({}) }))
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: () => {}, replace: () => {} }),
}))

vi.stubGlobal('__', (s: string) => s)

// ProgrammingExercises' title calls the String.prototype.format that frappe's
// translation layer patches in at runtime.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

const MODERATOR = { name: 'admin@test.com', is_moderator: true }

async function mountPage(path: string) {
	const { default: Page } = await import(/* @vite-ignore */ path)
	const wrapper = mount(Page, {
		global: {
			provide: {
				$user: { data: { ...MODERATOR } },
				$dayjs: () => ({ format: () => '' }),
			},
			mocks: { __: (s: string) => s },
			stubs: { 'router-view': true, 'router-link': true },
		},
	})
	await flushPromises()
	return wrapper
}

async function reloadsForOneSearch(path: string) {
	const wrapper = await mountPage(path)
	const before = { ...reloads.current }
	await wrapper.find('[data-testid="search"]').setValue('x')
	await nextTick()
	await flushPromises()
	const delta: Record<string, number> = {}
	for (const key of Object.keys(reloads.current)) {
		delta[key] = reloads.current[key] - (before[key] || 0)
	}
	return delta
}

beforeEach(() => {
	reloads.current = {}
	window.history.replaceState({}, '', '/lms')
	vi.resetModules()
})

describe('search box reloads once per typed value', () => {
	it('Jobs', async () => {
		const delta = await reloadsForOneSearch('@/pages/Jobs.vue')
		expect(delta['lms.lms.api.get_job_opportunities']).toBe(1)
		expect(delta['lms.lms.api.get_job_opportunities_count']).toBe(1)
	})

	it('Batches', async () => {
		const delta = await reloadsForOneSearch('@/pages/Batches/Batches.vue')
		expect(delta['lms.lms.utils.get_batches']).toBe(1)
		expect(delta['lms.lms.utils.get_batch_count']).toBe(1)
	})

	it('CertifiedParticipants', async () => {
		const delta = await reloadsForOneSearch('@/pages/CertifiedParticipants.vue')
		expect(delta['lms.lms.api.get_certified_participants']).toBe(1)
	})

	it('ProgrammingExercises', async () => {
		const delta = await reloadsForOneSearch(
			'@/pages/ProgrammingExercises/ProgrammingExercises.vue'
		)
		expect(delta['LMS Programming Exercise']).toBe(1)
		expect(delta['frappe.client.get_count']).toBe(1)
	})
})

describe('search text from the query string', () => {
	it('Batches fetches once on mount', async () => {
		window.history.replaceState({}, '', '/lms/batches?title=vue')
		await mountPage('@/pages/Batches/Batches.vue')
		expect(reloads.current['lms.lms.utils.get_batches']).toBe(1)
	})

	it('CertifiedParticipants fetches once on mount', async () => {
		window.history.replaceState({}, '', '/lms/certified?name=vue')
		await mountPage('@/pages/CertifiedParticipants.vue')
		expect(reloads.current['lms.lms.api.get_certified_participants']).toBe(1)
	})
})
