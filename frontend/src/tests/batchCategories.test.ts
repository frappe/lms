// The category chips come from every published batch's category, fetched beside
// the list, not from whichever batch rows have loaded.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const TODAY = '2026-10-09'

vi.mock('frappe-ui', () => {
	const resource = (options: { url?: string } = {}) =>
		reactive({
			data: (options.url === 'lms.lms.utils.get_batch_categories'
				? [
						{ label: '', value: null },
						{ label: 'Design', value: 'Design' },
						{ label: 'ERPNext', value: 'ERPNext' },
				  ]
				: null) as unknown,
			hasNextPage: false,
			pageLength: 24,
			list: { loading: false },
			update: () => {},
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
		template: '<div><slot name="toolbar" /></div>',
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

describe('the batch list category chips', () => {
	it('lists every published batch category before any batch loads', async () => {
		window.history.replaceState({}, '', '/lms/batches')
		const wrapper = await mountAs({
			name: 'moderator@example.com',
			is_moderator: true,
		})
		const chips = wrapper
			.findAll('[role="group"][aria-label="Category"] button')
			.map((chip) => chip.text())
		expect(chips).toEqual(['All', 'Design', 'ERPNext'])
	})
})
