// Students and guests see one "All" tab. It must hold what the admin Active tab
// holds, published batches that have not ended, so a batch stays listed after
// its start date instead of vanishing the day it begins.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const TODAY = '2026-10-09'

const { sent } = vi.hoisted(() => ({
	sent: { filters: null as Record<string, unknown> | null },
}))

vi.mock('frappe-ui', () => {
	const resource = () =>
		reactive({
			data: null as unknown,
			hasNextPage: false,
			pageLength: 24,
			list: { loading: false },
			update: (options: { filters?: Record<string, unknown> }) => {
				if (options.filters) {
					sent.filters = JSON.parse(JSON.stringify(options.filters))
				}
			},
			reload: () => Promise.resolve([]),
			submit: () => {},
			abort: () => {},
		})
	return {
		usePageMeta: () => {},
		createListResource: resource,
		createResource: resource,
		Button: { template: '<button><slot /></button>' },
		Dropdown: { template: '<div><slot :open="false" /></div>' },
		FormControl: { template: '<input />' },
		TabButtons: {
			props: ['options', 'modelValue'],
			emits: ['update:modelValue'],
			template: `<div>
				<button
					v-for="option in options"
					:key="option.value"
					:data-tab="option.value"
					@click="$emit('update:modelValue', option.value)"
				/>
			</div>`,
		},
	}
})

vi.mock('@/components/Controls/ClearableCombobox.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Controls/ToggleFilter.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/pages/Batches/components/BatchCard.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: {
		template: '<div><slot name="filters" /></div>',
	},
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/composables/useFormRoute', () => ({ openFormRoute: () => {} }))
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: () => {}, replace: () => {} }),
}))

vi.stubGlobal('__', (s: string) => s)

// The page title calls the String.prototype.format that frappe's translation
// layer patches in at runtime.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

// @ts-expect-error a JS SFC has no generated types (TS7016)
import Batches from '@/pages/Batches/Batches.vue'

async function mountAs(userData: Record<string, unknown> | null) {
	const wrapper = mount(Batches, {
		global: {
			provide: {
				$user: { data: userData },
				$dayjs: () => ({ format: () => TODAY }),
			},
			mocks: { __: (s: string) => s },
			stubs: { 'router-view': true, 'router-link': true },
		},
	})
	await flushPromises()
	return wrapper
}

const ACTIVE = { end_date: ['>=', TODAY], published: 1 }

beforeEach(() => {
	sent.filters = null
	window.history.replaceState({}, '', '/lms/batches')
})

describe('batch list filters for students and guests', () => {
	it('a student on All gets the active filter, with no start_date', async () => {
		await mountAs({ name: 'student@test.com', is_student: true })
		expect(sent.filters).toEqual(ACTIVE)
	})

	it('a guest gets the active filter, with no start_date', async () => {
		await mountAs(null)
		expect(sent.filters).toEqual(ACTIVE)
	})

	it('a student moving to Enrolled drops the date filter', async () => {
		const wrapper = await mountAs({
			name: 'student@test.com',
			is_student: true,
		})
		await wrapper.find('[data-tab="enrolled"]').trigger('click')
		await flushPromises()
		expect(sent.filters).toEqual({ enrolled: 1 })
	})

	it('a student back on All gets the active filter again', async () => {
		const wrapper = await mountAs({
			name: 'student@test.com',
			is_student: true,
		})
		await wrapper.find('[data-tab="enrolled"]').trigger('click')
		await flushPromises()
		await wrapper.find('[data-tab="all"]').trigger('click')
		await flushPromises()
		expect(sent.filters).toEqual(ACTIVE)
	})
})
