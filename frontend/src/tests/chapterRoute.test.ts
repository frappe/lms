import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { createResourceMock, passthrough } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		passthrough: {
			inheritAttrs: false,
			template: `<div><slot name="icon" /><slot /></div>`,
		},
	}
})

// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

// frappe-ui's ESM build does not resolve under vitest, so every export
// CourseOutline, ChapterForm and FormShell reach for is stubbed by hand.
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" /></label>`,
	},
	FormLabel: { props: ['label'], template: `<label>{{ label }}</label>` },
	FileUploader: passthrough,
	Switch: passthrough,
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: { props: ['modelValue', 'label'], template: `<label />` },
}))
vi.mock('vuedraggable', () => ({
	default: { props: ['list'], template: `<div />` },
}))
vi.mock('@/components/ChapterRow.vue', () => ({
	default: { template: `<div />` },
}))

// The course page is stubbed so this test does not drag in CourseDetail's own
// dependency chain, but it keeps a nested outlet — without one the child route
// resolves and then renders nothing.
vi.mock('@/pages/Courses/CourseDetail.vue', () => ({
	default: defineComponent({
		render: () => h('div', ['COURSE', h(RouterView)]),
	}),
}))

// The REAL route table, not a copy: a reimplemented table would only prove that
// vue-router nests what you tell it to nest.
import { routes } from '@/routes'
import CourseOutline from '@/components/CourseOutline.vue'
// Imported statically as well as through the table's lazy `() => import(...)`.
// The route table's copy resolves the same module instance, but only once it is
// already in the graph — left to the dynamic import alone, a navigation started
// by a click has to wait on a cold transform, which under a parallel suite run
// overruns the test timeout.
import ChapterForm from '@/pages/Forms/ChapterForm.vue'

const outlineResource = reactive({
	data: [] as unknown[],
	loading: false,
	fetch: vi.fn(),
	reload: vi.fn(),
})
createResourceMock.mockImplementation((options: { url: string }) =>
	options.url === 'lms.lms.utils.get_course_outline'
		? outlineResource
		: reactive({ loading: false, submit: vi.fn() })
)

// The real value TabbedDetailPage writes: it hashes the tab KEY, not its
// label, so the course editor tab is `#editor` (CourseDetail.vue's tab list,
// TabbedDetailPage.vue:157-159). Using the value the app actually produces is
// the point — a preserved-but-wrong hash would still select tab 0.
const COURSE_TAB = '#editor'
const LESSON_QUERY = { editLesson: '1-1' }

const makeRouter = (): Router =>
	createRouter({ history: createMemoryHistory(), routes })

// CourseOutline is a component, not a page: it only needs the router installed
// to reach openFormRoute. Rendering the outlet beside it lets one mount cover
// both ends of the round trip.
const mountOutlineAndOutlet = async (router: Router) => {
	const wrapper = mount(
		defineComponent({
			render: () => [
				h(CourseOutline, {
					courseName: 'COURSE-1',
					title: 'Chapters',
					allowEdit: true,
				}),
				h(RouterView),
			],
		}),
		{
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'mod@example.com' } } },
				stubs: { teleport: true },
				// `mocks` lands on app.config.globalProperties, which is where
				// CourseOutline reads $dialog from.
				mocks: { __: (text: string) => text, $dialog: vi.fn() },
			},
		}
	)
	await flushPromises()
	return wrapper
}

// The route components are lazy imports, so a navigation started by a click
// resolves a real module load — flushPromises only drains microtasks and would
// return while the navigation is still pending. Wait for the router to say it
// landed instead.
const nextNavigation = (router: Router): Promise<void> =>
	new Promise((resolve) => {
		const off = router.afterEach(() => {
			off()
			resolve()
		})
	})

const clickAdd = async (
	wrapper: ReturnType<typeof mount>,
	router: Router
): Promise<void> => {
	const add = wrapper
		.findAll('button')
		.find((button) => button.text() === 'Add')
	expect(add).toBeDefined()
	const navigated = nextNavigation(router)
	await add!.trigger('click')
	await navigated
	await flushPromises()
}

const dismissDialog = async (
	wrapper: ReturnType<typeof mount>,
	router: Router
): Promise<void> => {
	const navigated = nextNavigation(router)
	wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
	await navigated
	await flushPromises()
}

describe('the chapter route', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	// resolve(), not push(): matching is synchronous and does not pull in the
	// lazy page components, several of which (Lesson.vue) are very expensive to
	// transform for an assertion that is purely about the route table.
	it('resolves /courses/X/chapter/new to the form nested under the course', () => {
		const router = makeRouter()
		const resolved = router.resolve('/courses/COURSE-1/chapter/new')
		expect(resolved.name).toBe('ChapterForm')
		expect(resolved.matched.map((r) => r.name)).toEqual([
			'CourseDetail',
			'ChapterForm',
		])
		expect(resolved.params.chapterName).toBe('new')
		expect(resolved.params.courseName).toBe('COURSE-1')
	})

	it('points that route at the chapter form itself', async () => {
		type LazyRecord = {
			name?: unknown
			children?: LazyRecord[]
			component?: () => Promise<unknown>
		}
		const record = (routes as LazyRecord[])
			.find((route) => route.name === 'CourseDetail')
			?.children?.find((child) => child.name === 'ChapterForm')
		expect(record?.component).toBeTypeOf('function')
		await expect(record!.component!()).resolves.toMatchObject({
			default: ChapterForm,
		})
	})

	it('leaves the existing course routes alone', () => {
		const router = makeRouter()
		expect(router.resolve('/courses/COURSE-1').name).toBe('CourseDetail')
		expect(router.resolve('/courses/COURSE-1/learn/1-2').name).toBe('Lesson')
		expect(router.resolve('/courses/COURSE-1/certification').name).toBe(
			'CourseCertification'
		)
	})

	// C2. CourseDetail keeps its active tab in route.hash and CourseEditor keeps
	// the open lesson in route.query. A child route that drops either resets the
	// page behind the open form — invisible unless something asserts it.
	it('carries the hash and query onto the form when opening it', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
			query: LESSON_QUERY,
		})
		const wrapper = await mountOutlineAndOutlet(router)

		await clickAdd(wrapper, router)
		expect(router.currentRoute.value.name).toBe('ChapterForm')
		expect(router.currentRoute.value.hash).toBe(COURSE_TAB)
		expect(router.currentRoute.value.query).toEqual(LESSON_QUERY)
	})

	it('gets the hash and query back when the form is closed', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
			query: LESSON_QUERY,
		})
		const wrapper = await mountOutlineAndOutlet(router)

		await clickAdd(wrapper, router)
		await dismissDialog(wrapper, router)

		expect(router.currentRoute.value.name).toBe('CourseDetail')
		expect(router.currentRoute.value.hash).toBe(COURSE_TAB)
		expect(router.currentRoute.value.query).toEqual(LESSON_QUERY)
	})

	// The deep-link close is the path that actually reads the `parent` location
	// handed to useFormRoute — the pop above would restore the hash from history
	// even if that location had none.
	it('replaces to the course WITH its hash and query on a deep-linked close', async () => {
		const router = makeRouter()
		await router.push({
			name: 'ChapterForm',
			params: { courseName: 'COURSE-1', chapterName: 'new' },
			hash: COURSE_TAB,
			query: LESSON_QUERY,
		})
		const wrapper = await mountOutlineAndOutlet(router)

		await dismissDialog(wrapper, router)

		expect(router.currentRoute.value.name).toBe('CourseDetail')
		expect(router.currentRoute.value.hash).toBe(COURSE_TAB)
		expect(router.currentRoute.value.query).toEqual(LESSON_QUERY)
	})

	it('opens an existing chapter for edit rather than as a new one', async () => {
		outlineResource.data = [
			{ name: 'CHAPTER-9', title: 'Ninth', idx: 9, lessons: [] },
		]
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
		})
		const wrapper = await mountOutlineAndOutlet(router)

		const outline = wrapper.findComponent(CourseOutline)
		const navigated = nextNavigation(router)
		;(
			outline.vm as unknown as {
				openChapterForm: (c: { name: string }) => void
			}
		).openChapterForm({ name: 'CHAPTER-9' })
		await navigated

		expect(router.currentRoute.value.params.chapterName).toBe('CHAPTER-9')
		expect(router.currentRoute.value.hash).toBe(COURSE_TAB)
		outlineResource.data = []
	})
})
