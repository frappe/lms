import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

interface Chapter {
	name: string
	idx: number
	lessons: Array<{ name: string; number: string }>
}

const state = vi.hoisted(() => ({
	outline: null as any,
	route: null as any,
	reloads: [] as Array<(chapters: Chapter[] | null) => void>,
	formMounts: 0,
	course: null as any,
}))

vi.mock('vue-router', () => ({
	useRoute: () => state.route,
	useRouter: () => ({
		replace: vi.fn((to: { query: Record<string, string>; hash?: string }) => {
			state.route.query = to.query
			state.route.hash = to.hash ?? ''
			return Promise.resolve()
		}),
	}),
}))

// The outline's reload stays pending until a test settles it. Settling with
// null is a failed request: frappe-ui resolves it and keeps the old data.
vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: () => {
			const r: any = reactive({ data: null, loading: false })
			r.fetch = vi.fn()
			r.reset = vi.fn(() => (r.data = null))
			r.reload = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						state.reloads.push((chapters) => {
							if (chapters) r.data = chapters
							resolve()
						})
					})
			)
			state.outline = r
			return r
		},
		Button: { name: 'Button', render: () => null },
	}
})

vi.mock('@/pages/LessonForm.vue', async () => {
	const { defineComponent, h, onMounted } = await import('vue')
	return {
		default: defineComponent({
			name: 'LessonForm',
			props: ['courseName', 'chapterNumber', 'lessonNumber', 'draftChapter'],
			emits: ['saved', 'created'],
			setup() {
				onMounted(() => state.formMounts++)
				return () => h('div', { class: 'lesson-form-stub' })
			},
		}),
	}
})

vi.mock('@/components/CourseOutline.vue', async () => {
	const { defineComponent, h } = await import('vue')
	return {
		default: defineComponent({
			name: 'CourseOutline',
			emits: [
				'select-lesson',
				'lesson-deleted',
				'chapter-deleted',
				'add-lesson',
			],
			setup: () => () => h('div'),
		}),
	}
})
vi.mock('@/components/BottomSheet.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/components/SkeletonLoader.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/components/Modals/VideoStatistics.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/stores/sidebar', () => ({
	useSidebar: () => ({ isSidebarCollapsed: false }),
}))
vi.mock('@/utils/composables', async () => {
	const { ref } = await import('vue')
	return { useScreenSize: () => ({ isMobile: ref(false) }) }
})

import { defineComponent, h, reactive, ref } from 'vue'
import CourseEditor from '@/pages/Courses/CourseEditor.vue'

const chapterA = (idx: number, extra: string[] = []): Chapter => ({
	name: 'CH-A',
	idx,
	lessons: ['L-A1', ...extra].map((name, i) => ({
		name,
		number: `${idx}-${i + 1}`,
	})),
})
const chapterB = (idx: number, extra: string[] = []): Chapter => ({
	name: 'CH-B',
	idx,
	lessons: ['L-B1', ...extra].map((name, i) => ({
		name,
		number: `${idx}-${i + 1}`,
	})),
})

async function mountEditor(chapters: Chapter[], query = {}) {
	state.route = reactive({ query, hash: '#editor' })
	// Bound with v-model as CourseDetail does: an assigned selection reads back
	// the old value until the parent re-renders.
	state.course = reactive({ data: { name: 'C1' } })
	const course = state.course
	const Parent = defineComponent({
		setup() {
			const selected = ref(null)
			return () =>
				h(CourseEditor, {
					course,
					selected: selected.value,
					'onUpdate:selected': (value: any) => (selected.value = value),
				})
		},
	})
	const wrapper = mount(Parent, {
		global: { mocks: { __: (s: string) => s } },
	})
	state.outline.data = chapters
	await flushPromises()
	state.formMounts = 0
	return wrapper
}

const form = (wrapper: VueWrapper) =>
	wrapper.findComponent({ name: 'LessonForm' })
const outline = (wrapper: VueWrapper) =>
	wrapper.findComponent({ name: 'CourseOutline' })

async function addLesson(wrapper: VueWrapper, chapter: Chapter) {
	outline(wrapper).vm.$emit('add-lesson', { chapter })
	await flushPromises()
}

async function created(wrapper: VueWrapper, name: string, chapter: string) {
	form(wrapper).vm.$emit('created', { name, chapter })
	await flushPromises()
}

async function settleReload(chapters: Chapter[] | null) {
	state.reloads.shift()!(chapters)
	await flushPromises()
}

describe('CourseEditor draft lesson identity', () => {
	let wrapper: VueWrapper

	beforeEach(() => {
		state.reloads.length = 0
		localStorage.clear()
	})

	afterEach(() => wrapper?.unmount())

	it('keeps the draft URL on its chapter when the chapters are reordered', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		expect(state.route.query.editLesson).toBe('2-new')

		state.outline.data = [chapterB(1), chapterA(2)]
		await flushPromises()

		expect(state.route.query.editLesson).toBe('1-new')
		expect(form(wrapper).props('draftChapter')).toBe('CH-B')
		expect(state.formMounts).toBe(1)
	})

	it('reopens a draft in its own chapter after the indexes moved under it', async () => {
		wrapper = await mountEditor([chapterB(1), chapterA(2)], {
			editLesson: '2-new',
			draftChapter: 'CH-B',
		})

		expect(form(wrapper).props('draftChapter')).toBe('CH-B')
		expect(state.route.query.editLesson).toBe('1-new')
	})

	it('switches to the created lesson even when the outline reload fails', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		await created(wrapper, 'L-B2', 'CH-B')
		await settleReload(null)

		expect(state.route.query.editLessonName).toBe('L-B2')
		expect(state.route.query.editLesson).toBeUndefined()
		expect(state.route.query.draftChapter).toBeUndefined()
		expect(form(wrapper).props('draftChapter')).toBe('')
		expect(state.formMounts).toBe(1)
	})

	it('persists no guessed position before the outline has the lesson', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		await created(wrapper, 'L-B2', 'CH-B')

		expect(state.route.query.editLesson).toBeUndefined()
		expect(
			JSON.parse(localStorage.getItem('lms-course-editor-last-lesson')!)
		).toEqual({ C1: '1-1' })

		await settleReload([chapterA(1), chapterB(2, ['L-OTHER', 'L-B2'])])

		expect(state.route.query.editLesson).toBe('2-3')
		expect(state.route.query.editLessonName).toBeUndefined()
		expect(form(wrapper).props('lessonNumber')).toBe('3')
		expect(
			JSON.parse(localStorage.getItem('lms-course-editor-last-lesson')!)
		).toEqual({ C1: '2-3' })
		expect(state.formMounts).toBe(1)
	})

	it('reopens a created lesson by its docname after a refresh', async () => {
		wrapper = await mountEditor(
			[chapterA(1), chapterB(2, ['L-OTHER', 'L-B2'])],
			{ editLessonName: 'L-B2' }
		)

		expect(form(wrapper).props('lessonNumber')).toBe('3')
		expect(state.route.query.editLesson).toBe('2-3')
		expect(state.route.query.editLessonName).toBeUndefined()
	})

	it('follows a docname link while the editor is open', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2, ['L-B2'])])
		expect(form(wrapper).props('chapterNumber')).toBe('1')

		state.route.query = { editLessonName: 'L-B2' }
		await flushPromises()

		expect(form(wrapper).props('chapterNumber')).toBe('2')
		expect(form(wrapper).props('lessonNumber')).toBe('2')
		expect(state.route.query).toEqual({ editLesson: '2-2' })
	})

	it('opens a docname link once the outline catches up with it', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])

		state.route.query = { editLessonName: 'L-B2' }
		await flushPromises()
		expect(form(wrapper).exists()).toBe(false)

		state.outline.data = [chapterA(1), chapterB(2, ['L-B2'])]
		await flushPromises()

		expect(form(wrapper).props('lessonNumber')).toBe('2')
		expect(state.route.query).toEqual({ editLesson: '2-2' })
	})

	it('clears the editor and the URL when the open lesson is deleted', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)], {
			editLesson: '2-1',
		})
		outline(wrapper).vm.$emit('lesson-deleted', { lesson: 'L-B1' })
		await flushPromises()
		state.outline.data = [chapterA(1), { ...chapterB(2), lessons: [] }]
		await flushPromises()

		expect(form(wrapper).exists()).toBe(false)
		expect(state.route.query).toEqual({})
	})

	it('drops a draft whose chapter is deleted', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		outline(wrapper).vm.$emit('chapter-deleted', { chapter: 'CH-B' })
		await flushPromises()

		expect(form(wrapper).exists()).toBe(false)
		expect(state.route.query).toEqual({})
	})

	it('reopens a lesson by number after a refresh, else the stored one', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)], {
			editLesson: '2-1',
		})
		expect(form(wrapper).props('chapterNumber')).toBe('2')
		wrapper.unmount()

		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		expect(form(wrapper).props('chapterNumber')).toBe('2')
		expect(state.route.query).toEqual({ editLesson: '2-1' })
	})

	it('falls back to the default lesson when the URL drops its params', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))

		state.route.query = {}
		await flushPromises()

		expect(form(wrapper).props('lessonNumber')).toBe('1')
		expect(form(wrapper).props('draftChapter')).toBe('')
		expect(state.route.query).toEqual({ editLesson: '1-1' })
	})

	it('waits for the new course outline before opening its default', async () => {
		// Guards: a course switch re-reads the route, but resolved the default
		// against the old outline and pinned that lesson. Found on PR #2852.
		wrapper = await mountEditor([chapterA(1), chapterB(2)])

		state.course.data.name = 'C2'
		await flushPromises()
		state.outline.data = [
			{ name: 'CH-X', idx: 1, lessons: [{ name: 'L-X1', number: '1-1' }] },
		]
		await flushPromises()

		expect(form(wrapper).exists()).toBe(true)
		expect(form(wrapper).props('courseName')).toBe('C2')
		expect(state.route.query).toEqual({ editLesson: '1-1' })
	})

	it('puts a picked lesson in the URL, dropping the draft', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		outline(wrapper).vm.$emit('select-lesson', {
			chapterNumber: '1',
			lessonNumber: '1',
		})
		await flushPromises()

		expect(state.route.query.editLesson).toBe('1-1')
		expect(state.route.query.draftChapter).toBeUndefined()
	})

	it('leaves a newer draft in the same chapter alone when the reload lands', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		await created(wrapper, 'L-B2', 'CH-B')
		await addLesson(wrapper, chapterB(2))
		await settleReload([chapterA(1), chapterB(2, ['L-B2'])])

		expect(state.route.query.editLesson).toBe('2-new')
		expect(form(wrapper).props('lessonNumber')).toBe('new')
		expect(form(wrapper).props('draftChapter')).toBe('CH-B')
		expect(state.formMounts).toBe(2)
	})

	it('follows the created lesson to its position once the outline has it', async () => {
		wrapper = await mountEditor([chapterA(1), chapterB(2)])
		await addLesson(wrapper, chapterB(2))
		await created(wrapper, 'L-B2', 'CH-B')
		await settleReload([chapterB(1, ['L-B2']), chapterA(2)])

		expect(state.route.query.editLesson).toBe('1-2')
		expect(form(wrapper).props('chapterNumber')).toBe('1')
		expect(state.formMounts).toBe(1)
	})
})
