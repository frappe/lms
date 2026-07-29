/**
 * Courses.vue filter state.
 *
 * Every filter control funnels into `updateCourses()`, which reloads one shared
 * list resource. frappe-ui's `createResource` keeps no request sequence — the
 * last response to arrive assigns `out.data` (resources.js:113) — so a slow
 * response from a filter the user has already left can repaint the list with
 * the wrong rows. That is the bug behind "Unpublished shows nothing, then a few
 * seconds later it is full of published courses".
 *
 * The page no longer picks its own filter controls — ListPage and ToggleFilter
 * do — so ListPage is stubbed here and the real ToggleFilter is kept, to prove
 * one click still reaches the resource exactly once.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

type Rows = { name: string }[]

interface FakeRequest {
	filters: Record<string, unknown>
	aborted: boolean
	respond: (rows: Rows) => void
}

/**
 * Mirrors frappe-ui's list resource closely enough to expose ordering bugs:
 * responses are settled by hand, `abort()` cancels the fetch that is currently
 * in flight, and an un-aborted response always wins.
 */
function makeCoursesResource() {
	const requests: FakeRequest[] = []
	let inFlight: FakeRequest | null = null

	const resource = reactive({
		data: null as Rows | null,
		hasNextPage: false,
		pageLength: 30,
		filters: {} as Record<string, unknown>,
		list: {
			loading: false,
			abort: () => {
				if (inFlight) inFlight.aborted = true
			},
		},
		update({ filters }: { filters: Record<string, unknown> }) {
			resource.filters = JSON.parse(JSON.stringify(filters))
		},
		reload() {
			const request: FakeRequest = {
				filters: JSON.parse(JSON.stringify(resource.filters)),
				aborted: false,
				respond(rows: Rows) {
					if (!request.aborted) resource.data = rows
				},
			}
			inFlight = request
			requests.push(request)
		},
		next: vi.fn(),
	})

	return { resource, requests }
}

const { coursesResource, requests, mobile } = vi.hoisted(() => ({
	coursesResource: { current: null as any },
	requests: { current: [] as any[] },
	mobile: { value: false },
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(() => Promise.resolve(0)),
	usePageMeta: vi.fn(),
	createListResource: (options: { url: string }) => {
		if (options.url.includes('get_course_categories')) {
			return reactive({ data: [], list: { loading: false }, reload: vi.fn() })
		}
		return coursesResource.current
	},
	Button: { template: '<button><slot /></button>' },
	Dropdown: { template: '<div><slot :open="false" /></div>' },
	Tooltip: { template: '<div><slot /></div>' },
	// frappe-ui's Checkbox reports one click twice: onChange assigns its
	// defineModel and then re-emits update:modelValue (Checkbox.vue:76-77).
	Checkbox: defineComponent({
		props: { modelValue: Boolean, label: String },
		emits: ['update:modelValue'],
		methods: {
			onChange() {
				this.$emit('update:modelValue', !this.modelValue)
				this.$emit('update:modelValue', !this.modelValue)
			},
		},
		template: `<input
			type="checkbox"
			data-testid="toggle-checkbox"
			@change="onChange"
		/>`,
	}),
	FormControl: {
		inheritAttrs: false,
		props: ['modelValue', 'type', 'label', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<input
			v-bind="$attrs"
			:data-testid="'control-' + (label || type)"
			:type="type"
			:value="modelValue"
		/>`,
	},
	TabButtons: {
		props: ['options', 'modelValue'],
		emits: ['update:modelValue'],
		template: `<div>
			<button
				v-for="option in options"
				:key="option.value"
				:data-testid="'tab-' + option.value"
				:data-state="option.value === modelValue ? 'checked' : 'unchecked'"
				@click="$emit('update:modelValue', option.value)"
			>{{ option.label }}</button>
		</div>`,
	},
}))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return { useScreenSize: () => ({ isMobile: computed(() => mobile.value) }) }
})
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/utils', () => ({ canCreateCourse: () => true }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const stub = (template: string) => ({ default: { template } })
vi.mock('@/components/CourseCard.vue', () => stub('<article />'))
vi.mock('@/components/Controls/ClearableCombobox.vue', () => stub('<div />'))
vi.mock('@/pages/Courses/NewCourseModal.vue', () => stub('<div />'))
vi.mock('@/pages/Courses/CourseImportModal.vue', () => stub('<div />'))

// Stands in for the whole page shell, so this file stays about filter state.
vi.mock('@/components/Layouts/ListPage.vue', () => ({
	default: {
		props: ['rows', 'breadcrumbs', 'title'],
		template: `<div>
			<slot name="actions" />
			<slot name="tabs" />
			<slot name="filters" />
			<slot name="toggles" />
			<slot v-for="row in rows" :key="row.name" name="card" :row="row" />
		</div>`,
	},
}))

vi.stubGlobal('__', (s: string) => s)

const MODERATOR = { name: 'admin@test.com', is_moderator: true }
const PUBLISHED_COURSES = [{ name: 'course-a' }, { name: 'course-b' }]

async function mountCourses(user: { data: Record<string, unknown> | null }) {
	const { default: Courses } = await import('@/pages/Courses/Courses.vue')
	const wrapper = mount(Courses, {
		global: {
			provide: {
				$user: user,
				$dayjs: () => ({ add: () => ({ format: () => '' }) }),
			},
			mocks: { __: (s: string) => s },
			stubs: { 'router-link': { template: '<a><slot /></a>' } },
		},
	})
	await nextTick()
	return wrapper
}

const cards = (wrapper: any) => wrapper.findAll('article').length
const checkedTab = (wrapper: any) =>
	wrapper.find('[data-state="checked"]').attributes('data-testid')

beforeEach(() => {
	mobile.value = false
	window.history.replaceState({}, '', '/lms/courses')
	const fake = makeCoursesResource()
	coursesResource.current = fake.resource
	requests.current = fake.requests
	vi.resetModules()
})

describe('Courses list filters', () => {
	it('drops a slow response from the tab the user has already left', async () => {
		const wrapper = await mountCourses({ data: { ...MODERATOR } })

		// The mount fetch for the default Published tab is still in flight.
		expect(requests.current).toHaveLength(1)
		expect(requests.current[0].filters).toMatchObject({ published: 1, live: 1 })

		await wrapper.find('[data-testid="tab-unpublished"]').trigger('click')
		await nextTick()
		expect(requests.current).toHaveLength(2)
		expect(requests.current[1].filters).toMatchObject({ published: 0 })

		// Unpublished answers first: there are none.
		requests.current[1].respond([])
		await nextTick()
		expect(cards(wrapper)).toBe(0)

		// The Published fetch finally lands. It must not repaint the list.
		requests.current[0].respond(PUBLISHED_COURSES)
		await nextTick()

		expect(checkedTab(wrapper)).toBe('tab-unpublished')
		expect(cards(wrapper)).toBe(0)
	})

	it('keeps the selected tab when the user resource resolves again', async () => {
		const user = reactive({ data: { ...MODERATOR } as Record<string, unknown> })
		const wrapper = await mountCourses(user)

		await wrapper.find('[data-testid="tab-unpublished"]').trigger('click')
		await nextTick()
		const requestsAfterTabChange = requests.current.length

		// A second resolution of get_user_info rebuilds `courseTabs`.
		user.data = { ...MODERATOR }
		await nextTick()

		expect(checkedTab(wrapper)).toBe('tab-unpublished')
		expect(requests.current).toHaveLength(requestsAfterTabChange)
	})

	it('sends one request with the new value from the desktop certification checkbox', async () => {
		const wrapper = await mountCourses({ data: { ...MODERATOR } })

		await wrapper.find('[data-testid="toggle-checkbox"]').trigger('change')
		await nextTick()

		expect(requests.current).toHaveLength(2)
		expect(requests.current[1].filters).toMatchObject({ certification: 1 })
	})

	it('sends the same request from the mobile certification chip', async () => {
		mobile.value = true
		const wrapper = await mountCourses({ data: { ...MODERATOR } })

		await wrapper.find('button[aria-pressed]').trigger('click')
		await nextTick()

		expect(requests.current).toHaveLength(2)
		expect(requests.current[1].filters).toMatchObject({ certification: 1 })
		expect(
			wrapper.find('button[aria-pressed]').attributes('aria-pressed')
		).toBe('true')
	})

	it('reads certification=false from the query string as off', async () => {
		mobile.value = true
		window.history.replaceState({}, '', '/lms/courses?certification=false')
		const wrapper = await mountCourses({ data: { ...MODERATOR } })

		expect(requests.current[0].filters).not.toHaveProperty('certification')
		expect(
			wrapper.find('button[aria-pressed]').attributes('aria-pressed')
		).toBe('false')
	})
})
