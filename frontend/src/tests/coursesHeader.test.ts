import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { state, openFormRouteMock, captureMock } = vi.hoisted(() => ({
	// Whether the user may create courses.
	state: { canCreate: true },
	openFormRouteMock: vi.fn(),
	captureMock: vi.fn(),
}))

// Only the header actions are under test.
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
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
	reload: vi.fn(),
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
		emits: ['update:open'],
		setup:
			(p, { slots, emit }) =>
			() =>
				h('div', { onClick: () => emit('update:open', true) }, [
					slots.default?.({ open: false }),
					h(
						'ul',
						{ 'data-testid': 'create-menu' },
						p.options.map((o: { label: string; onClick: () => void }) =>
							h('li', { onClick: o.onClick }, o.label)
						)
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

vi.mock('@/utils', () => ({ canCreateCourse: () => state.canCreate }))
vi.mock('@/composables/useFormRoute', () => ({
	openFormRoute: openFormRouteMock,
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: captureMock }),
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Controls/ClearableCombobox.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))
vi.mock('@/components/Controls/ToggleFilter.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))

const mountCourses = async () => {
	const { default: Courses } = await import('@/pages/Courses/Courses.vue')
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/', name: 'Courses', component: { render: () => null } }],
	})
	await router.push('/')
	await router.isReady()
	const wrapper = mount(Courses, {
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'a@b.c', is_moderator: 1 } },
				$dayjs: () => ({ format: () => '' }),
			},
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe('Courses page header', () => {
	beforeEach(() => {
		state.canCreate = true
		openFormRouteMock.mockReset()
		captureMock.mockReset()
	})

	it('offers New Course as a button, with the imports behind Import', async () => {
		const wrapper = await mountCourses()
		const header = wrapper.find('header')

		expect(header.findAll('button').map((b) => b.text())).toEqual([
			'Import',
			'New Course',
		])
		expect(header.find('[data-testid="create-menu"]').text()).toBe(
			'Import from a spreadsheetImport via ZIP'
		)

		await header.findAll('button')[1].trigger('click')
		expect(openFormRouteMock).toHaveBeenCalledWith(expect.anything(), {
			name: 'NewCourse',
		})
	})

	it('reports where the form was opened from and which import was picked', async () => {
		const { takeFormSource } = await import('@/composables/formTracking')
		const wrapper = await mountCourses()
		const header = wrapper.find('header')

		await header.findAll('button')[1].trigger('click')
		expect(takeFormSource()).toBe('header_button')
		expect(takeFormSource()).toBe('direct')

		await header.find('[data-testid="create-menu"]').trigger('click')
		expect(captureMock).toHaveBeenCalledWith('course_import_menu_opened')
		await header.findAll('li')[1].trigger('click')
		expect(captureMock).toHaveBeenCalledWith('course_import_clicked', {
			via: 'zip',
		})
	})

	it('shows nothing to someone who cannot create courses', async () => {
		state.canCreate = false
		const wrapper = await mountCourses()

		expect(wrapper.find('header').text()).toBe('')
	})
})
