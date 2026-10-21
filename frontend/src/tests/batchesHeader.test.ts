import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)
// translation.js installs String.prototype.format at app boot; the page title
// reads it on render.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return args.reduce<string>(
		(out, arg, i) => out.replaceAll(`{${i}}`, String(arg)),
		this
	)
}

const { state, openFormRouteMock } = vi.hoisted(() => ({
	// Whether the user may create batches.
	state: { isModerator: 1 },
	openFormRouteMock: vi.fn(),
}))

// Only the header actions are under test.
vi.mock('@/components/Layouts/ListPage.vue', () => ({
	default: defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('div', [h('header', slots.actions?.())]),
	}),
}))

const inertList = {
	data: [],
	list: { loading: false, abort: vi.fn() },
	hasNextPage: false,
	next: vi.fn(),
	reload: vi.fn(() => Promise.resolve([])),
	update: vi.fn(),
	pageLength: 24,
}

vi.mock('frappe-ui', () => ({
	Button: defineComponent({
		emits: ['click'],
		setup:
			(_, { slots, emit }) =>
			() =>
				h('button', { onClick: () => emit('click') }, slots.default?.()),
	}),
	Dropdown: defineComponent({
		props: ['options'],
		setup:
			(p, { slots }) =>
			() =>
				h('div', [
					slots.default?.({ open: false }),
					h(
						'ul',
						{ 'data-testid': 'create-menu' },
						p.options.map((o: { label: string }) => h('li', o.label))
					),
				]),
	}),
	FormControl: defineComponent({ setup: () => () => h('input') }),
	TabButtons: defineComponent({ setup: () => () => h('div') }),
	createListResource: vi.fn(() => inertList),
	createResource: vi.fn(() => ({
		data: 0,
		reload: vi.fn(),
		fetch: vi.fn(),
		submit: vi.fn(),
		abort: vi.fn(),
	})),
	usePageMeta: vi.fn(),
}))

vi.mock('@/composables/useFormRoute', () => ({
	openFormRoute: openFormRouteMock,
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Controls/ClearableCombobox.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))
vi.mock('@/components/Controls/ToggleFilter.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))
vi.mock('@/pages/Batches/components/BatchCard.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))

const mountBatches = async () => {
	const { default: Batches } = await import('@/pages/Batches/Batches.vue')
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Batches', component: { render: () => null } },
			{
				path: '/import/:doctype',
				name: 'NewDataImport',
				component: { render: () => null },
			},
		],
	})
	await router.push('/')
	await router.isReady()
	const wrapper = mount(Batches, {
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'a@b.c', is_moderator: state.isModerator } },
				$dayjs: () => ({ format: () => '' }),
			},
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return { wrapper, router }
}

describe('Batches page header', () => {
	beforeEach(() => {
		state.isModerator = 1
		openFormRouteMock.mockReset()
	})

	it('offers New Batch as a button, with Import beside it', async () => {
		const { wrapper, router } = await mountBatches()
		const buttons = wrapper.find('header').findAll('button')

		expect(buttons.map((b) => b.text())).toEqual(['Import', 'New Batch'])

		await buttons[1].trigger('click')
		expect(openFormRouteMock).toHaveBeenCalledWith(expect.anything(), {
			name: 'NewBatch',
		})
		const { takeFormSource } = await import('@/composables/formTracking')
		expect(takeFormSource()).toBe('header_button')

		await buttons[0].trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.params).toEqual({ doctype: 'LMS Batch' })
	})

	it('shows nothing to someone who cannot create batches', async () => {
		state.isModerator = 0
		const { wrapper } = await mountBatches()

		expect(wrapper.find('header').text()).toBe('')
	})
})
