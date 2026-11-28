/**
 * Course-side skeletons: each section holds its own skeleton until its own
 * resource has data, and a refetch (loading again, data kept) never brings it
 * back.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { translate } from './helpers/translate'

type FakeResource = {
	data: unknown
	loading: boolean
	error: unknown
	reload: () => void
	fetch: () => void
}

const resources = vi.hoisted(() => new Map<string, unknown>())

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (options: { url: string }) => {
			const resource = reactive({
				data: null,
				loading: true,
				error: null,
				reload: () => {},
				fetch: () => {},
				refresh: () => {},
			})
			resources.set(options.url, resource)
			return resource
		},
		Button: { template: '<button><slot name="icon" /><slot /></button>' },
		Tooltip: { template: '<span><slot /></span>' },
		toast: { error: vi.fn() },
	}
})

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: {}, hash: '' }),
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('vuedraggable', () => ({
	default: {
		props: ['list'],
		template:
			'<div><template v-for="element in list" :key="element.name"><slot name="item" :element="element" /></template></div>',
	},
}))
vi.mock('@/components/ChapterRow.vue', () => ({
	default: { props: ['chapter'], template: '<div class="chapter-row" />' },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Modals/ReviewModal.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils', () => ({ formatRating: (r: number) => String(r) }))

vi.stubGlobal('__', translate)

const resource = (url: string) => resources.get(url) as FakeResource

const OUTLINE = [
	{ name: 'CH-1', title: 'One', idx: 1, lessons: [] },
	{ name: 'CH-2', title: 'Two', idx: 2, lessons: [] },
]

/** Skeleton with no data, gone once data lands, absent on a refetch. */
async function expectSkeletonLifecycle(
	wrapper: ReturnType<typeof mount>,
	url: string,
	selector: string,
	data: unknown
) {
	expect(wrapper.find(selector).exists()).toBe(true)
	expect(wrapper.find(selector).attributes('aria-hidden')).toBe('true')

	resource(url).data = data
	resource(url).loading = false
	await nextTick()
	expect(wrapper.find(selector).exists()).toBe(false)

	resource(url).loading = true
	await nextTick()
	expect(wrapper.find(selector).exists()).toBe(false)
}

const global = {
	mocks: { __: translate },
	stubs: { RouterLink: true, 'router-link': true, LucideStar: true },
}

describe('CourseOutline', () => {
	it('holds outline rows until its own outline arrives', async () => {
		const { default: CourseOutline } = await import(
			'@/components/CourseOutline.vue'
		)
		const wrapper = mount(CourseOutline, {
			props: { courseName: 'C1', skeletonRows: 5 },
			global,
		})
		const skeleton = '[data-testid="outline-skeleton"]'
		expect(wrapper.findAll(`${skeleton} > div`)).toHaveLength(5)
		await expectSkeletonLifecycle(
			wrapper,
			'lms.lms.utils.get_course_outline',
			skeleton,
			OUTLINE
		)
		expect(wrapper.findAll('.chapter-row')).toHaveLength(2)
	})
})

describe('StudentLessonSidebar', () => {
	it('holds outline rows until the chapters arrive', async () => {
		resources.clear()
		const { default: StudentLessonSidebar } = await import(
			'@/components/StudentLessonSidebar.vue'
		)
		const wrapper = mount(StudentLessonSidebar, {
			props: { courseName: 'C1', courseTitle: 'Course', progress: 10 },
			global,
		})
		await expectSkeletonLifecycle(
			wrapper,
			'lms.lms.utils.get_course_outline',
			'[data-testid="outline-skeleton"]',
			OUTLINE
		)
		expect(wrapper.text()).toContain('One')
	})
})

describe('CourseReviews', () => {
	it('keeps the heading and holds the summary until reviews arrive', async () => {
		resources.clear()
		const { default: CourseReviews } = await import(
			'@/components/CourseReviews.vue'
		)
		const wrapper = mount(CourseReviews, {
			props: { courseName: 'C1' },
			global: {
				...global,
				provide: {
					$user: { data: { name: 'a@b.c', has_lms_role: false } },
					$dayjs: () => ({}),
				},
			},
		})
		expect(wrapper.find('h2').exists()).toBe(true)
		// No reviews and no membership: the section goes once the answer says so.
		await expectSkeletonLifecycle(
			wrapper,
			'lms.lms.utils.get_reviews',
			'[data-testid="reviews-skeleton"]',
			[]
		)
		expect(wrapper.find('h2').exists()).toBe(false)
	})
})

describe('SkeletonOverlay', () => {
	it('hides the real fields in place under the skeleton, then shows them', async () => {
		const { default: SkeletonOverlay } = await import(
			'@/components/Skeletons/SkeletonOverlay.vue'
		)
		const state = reactive({ active: true })
		const wrapper = mount({
			components: { SkeletonOverlay },
			setup: () => ({ state }),
			template: `<SkeletonOverlay :active="state.active">
				<input data-testid="field" />
				<template #skeleton><i /></template>
			</SkeletonOverlay>`,
		})
		const overlay = '[data-testid="skeleton-overlay"]'
		expect(wrapper.find(overlay).attributes('aria-hidden')).toBe('true')
		expect(
			wrapper.get('[data-testid="field"]').element.parentElement?.className
		).toContain('invisible')

		state.active = false
		await nextTick()
		expect(wrapper.find(overlay).exists()).toBe(false)
		expect(
			wrapper.get('[data-testid="field"]').element.parentElement?.className
		).not.toContain('invisible')
	})
})
