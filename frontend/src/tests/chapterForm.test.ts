import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type HistoryState,
	type Router,
} from 'vue-router'
import { defineComponent, h, nextTick, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// frappe-ui's internal module resolution doesn't work under vitest (see
// newBatchForm.test.ts, FormShell.test.ts), so importActual() on it throws
// ERR_MODULE_NOT_FOUND: every export the form and FormShell pull in has to be
// stubbed by hand.
const { createResourceMock, getCachedResourceMock, passthrough } =
	vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		getCachedResourceMock: vi.fn(),
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

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	getCachedResource: getCachedResourceMock,
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
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	FormLabel: {
		props: ['label', 'required', 'id'],
		template: `<label :for="id">{{ label }}</label>`,
	},
	FileUploader: passthrough,
	Switch: passthrough,
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'size'],
		template: `<label>{{ label }}</label>`,
	},
}))

import ChapterForm from '@/pages/Forms/ChapterForm.vue'
import type { OutlineChapter } from '@/types'

// One shared, reactive stand-in per resource the form creates. The outline is
// mutated by the tests to model "the parent already loaded it" vs "cold deep
// link, nothing loaded yet".
const outlineResource = reactive<{
	data: OutlineChapter[] | null
	loading: boolean
	fetch: ReturnType<typeof vi.fn>
	reload: ReturnType<typeof vi.fn>
}>({
	data: null,
	loading: false,
	fetch: vi.fn(),
	reload: vi.fn(),
})
const upsertResource = reactive({ loading: false, submit: vi.fn() })

// The instance CourseOutline/CourseEditor hold behind the form. The form no
// longer shares their cache key, so a save has to reach this one through
// getCachedResource instead of reloading its own.
const sharedOutline = { reload: vi.fn() }

createResourceMock.mockImplementation((options: { url: string }) =>
	options.url === 'lms.lms.utils.get_course_outline'
		? outlineResource
		: upsertResource
)

const optionsFor = (url: string): Record<string, unknown> =>
	(
		createResourceMock.mock.calls.find(
			(call) => (call[0] as { url: string }).url === url
		) as [Record<string, unknown>]
	)[0]

// The parent page is a route component too, so it has to render a nested
// RouterView or the child never mounts. RouterView is imported rather than
// written as the string 'router-view', which h() would leave unresolved.
const CoursePage = defineComponent({
	render: () => h('div', ['COURSE', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: CoursePage,
				props: true,
				children: [
					{
						path: 'chapter/:chapterName',
						name: 'ChapterForm',
						component: ChapterForm,
						props: true,
					},
				],
			},
		],
	})

const moderator = { name: 'mod@example.com', is_moderator: true }

// TabbedDetailPage hashes the tab KEY, not its label, so the course editor tab
// is `#editor` (TabbedDetailPage.vue:157-159).
const COURSE_TAB = '#editor'

const openForm = async (
	router: Router,
	chapterName: string,
	state?: HistoryState
) => {
	await router.push({
		name: 'ChapterForm',
		params: { courseName: 'COURSE-1', chapterName },
		hash: COURSE_TAB,
		state,
	})
}

const mountForm = async (
	router: Router,
	user: Record<string, unknown> | null = moderator
) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — it has to be on the instance too (see FormShell.test.ts).
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const chapterRow = (over: Partial<OutlineChapter> = {}): OutlineChapter => ({
	name: 'CHAPTER-1',
	title: 'Deep dive',
	idx: 1,
	is_scorm_package: 0,
	scorm_package: null,
	lessons: [],
	...over,
})

const titleInput = (wrapper: { find: (s: string) => { element: Element } }) =>
	(
		wrapper.find('[data-testid="chapter-fields"] input')
			.element as HTMLInputElement
	).value

describe('ChapterForm as a route', () => {
	beforeEach(() => {
		outlineResource.data = null
		outlineResource.fetch.mockClear()
		outlineResource.reload.mockClear()
		upsertResource.submit.mockReset()
		createResourceMock.mockClear()
		sharedOutline.reload.mockClear()
		getCachedResourceMock.mockReset()
		getCachedResourceMock.mockReturnValue(sharedOutline)
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent outline loaded', async () => {
		const router = makeRouter()
		await openForm(router, 'new')
		const wrapper = await mountForm(router)
		expect(wrapper.find('[data-testid="chapter-fields"]').exists()).toBe(true)
		expect(wrapper.html()).toContain('Add Chapter')
	})

	it('titles itself for edit when the route carries a chapter name', async () => {
		const router = makeRouter()
		await openForm(router, 'CHAPTER-1')
		const wrapper = await mountForm(router)
		expect(wrapper.html()).toContain('Edit Chapter')
		expect(wrapper.html()).not.toContain('Add Chapter')
	})

	it('refuses to render the form for a signed-out visitor', async () => {
		const router = makeRouter()
		await openForm(router, 'new')
		const wrapper = await mountForm(router, null)
		expect(wrapper.find('[data-testid="chapter-fields"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="chapter-save"]').exists()).toBe(false)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the chapter form', async () => {
		const router = makeRouter()
		await openForm(router, 'new')
		const wrapper = await mountForm(router)

		const labels = wrapper
			.find('[data-testid="chapter-fields"]')
			.findAll('label')
			.map((label) => label.text())
			.filter((text) => text !== '')
		// Exact set: a field lost in the modal→route move is otherwise invisible
		// to the rest of the suite.
		expect(labels).toEqual(['Title', 'SCORM Package'])
	})

	it('saves through its own resource', async () => {
		const router = makeRouter()
		await openForm(router, 'new')
		const wrapper = await mountForm(router)

		// The save goes through submitResource, which validates first: without a
		// title this never reaches the resource at all.
		await wrapper
			.find('[data-testid="chapter-fields"] input')
			.setValue('Chapter One')
		await wrapper.find('[data-testid="chapter-save"]').trigger('click')
		expect(upsertResource.submit).toHaveBeenCalledTimes(1)
	})

	// C4 — the highest-value test here. Edit mode used to be seeded from a row
	// the parent handed in; on a cold deep link that row does not exist.
	it('fetches the outline itself on a cold deep link and seeds edit mode', async () => {
		const router = makeRouter()
		await openForm(router, 'CHAPTER-1')
		const wrapper = await mountForm(router)

		expect(outlineResource.fetch).toHaveBeenCalledTimes(1)
		expect(titleInput(wrapper)).toBe('')

		outlineResource.data = [chapterRow()]
		await nextTick()
		expect(titleInput(wrapper)).toBe('Deep dive')
	})

	it('seeds without waiting for the fetch when data is already there', async () => {
		// Without `immediate` on the seeding watch the value never arrives,
		// because it never changes again.
		outlineResource.data = [chapterRow({ title: 'Already here' })]
		const router = makeRouter()
		await openForm(router, 'CHAPTER-1')
		const wrapper = await mountForm(router)

		expect(titleInput(wrapper)).toBe('Already here')
	})

	it('reads the outline through a cache key of its OWN', async () => {
		// Deliberately NOT ['course_outline', course]: createResource keeps the
		// FIRST constructor's options and hands that instance to everyone after
		// (resources.js:12-20). On a deep link to this form CourseOutline is not
		// mounted yet, so sharing the key handed IT this file's `auto: false` and
		// `progress: false`, and its chapter list rendered empty on a course that
		// has chapters.
		const router = makeRouter()
		await openForm(router, 'CHAPTER-1')
		await mountForm(router)

		const options = optionsFor('lms.lms.utils.get_course_outline')
		expect(options.cache).not.toEqual(['course_outline', 'COURSE-1'])
		expect(options.cache).toEqual(['chapter_form_outline', 'COURSE-1'])
		expect((options.makeParams as () => unknown)()).toEqual({
			course: 'COURSE-1',
			progress: false,
		})
	})

	it('targets the routed chapter on edit and no document on create', async () => {
		const router = makeRouter()
		outlineResource.data = [chapterRow()]
		await openForm(router, 'CHAPTER-1')
		await mountForm(router)
		expect(
			(
				optionsFor('lms.lms.api.upsert_chapter').makeParams as () => {
					name?: string
					title: string
				}
			)()
		).toMatchObject({ name: 'CHAPTER-1', title: 'Deep dive' })

		createResourceMock.mockClear()
		const createRouter2 = makeRouter()
		await openForm(createRouter2, 'new')
		await mountForm(createRouter2)
		expect(
			(
				optionsFor('lms.lms.api.upsert_chapter').makeParams as () => {
					name?: string
				}
			)().name
		).toBeUndefined()
	})

	it('will not save an edit before the chapter it is editing has loaded', async () => {
		const router = makeRouter()
		await openForm(router, 'CHAPTER-1')
		const wrapper = await mountForm(router)

		// Blank fields at this point mean "not loaded yet", not "cleared by the
		// user" — posting them would wipe the real chapter's title.
		const save = () => wrapper.find('[data-testid="chapter-save"]')
		expect(save().attributes('disabled')).toBeDefined()
		await save().trigger('click')
		expect(upsertResource.submit).not.toHaveBeenCalled()

		outlineResource.data = [chapterRow()]
		await nextTick()
		expect(save().attributes('disabled')).toBeUndefined()
		await save().trigger('click')
		expect(upsertResource.submit).toHaveBeenCalledTimes(1)
	})

	it('reloads the outline the page behind it holds, after a save', async () => {
		const router = makeRouter()
		await openForm(router, 'new')
		const wrapper = await mountForm(router)

		upsertResource.submit.mockImplementation(
			(_params: unknown, options: { onSuccess: () => void }) => {
				options.onSuccess()
			}
		)
		await wrapper
			.find('[data-testid="chapter-fields"] input')
			.setValue('Chapter One')
		await wrapper.find('[data-testid="chapter-save"]').trigger('click')
		await flushPromises()
		// The modal emitted created/updated for the parent to act on; a route
		// component has no parent listening, so it must refresh the outline
		// itself or the sidebar behind it goes stale. Its OWN instance is the
		// wrong one to reload — separate key, and saving navigates away from it.
		expect(getCachedResourceMock).toHaveBeenCalledWith([
			'course_outline',
			'COURSE-1',
		])
		expect(sharedOutline.reload).toHaveBeenCalledTimes(1)
		expect(outlineResource.reload).not.toHaveBeenCalled()
	})

	it('replaces rather than pushes on save, so Back leaves the form behind', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
		})
		await openForm(router, 'new', { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		upsertResource.submit.mockImplementation(
			(_params: unknown, options: { onSuccess: () => void }) => {
				options.onSuccess()
			}
		)
		await wrapper
			.find('[data-testid="chapter-fields"] input')
			.setValue('Chapter One')
		await wrapper.find('[data-testid="chapter-save"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')

		// One entry deep, not two: the form entry was consumed by the replace.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})

	it('mobile: the back control pops the router back to the course', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
		})
		await openForm(router, 'new', { lmsFormEntry: true })
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
		})
		await openForm(router, 'new', { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})
})
