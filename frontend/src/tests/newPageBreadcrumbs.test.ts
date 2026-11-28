import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const { pageMeta, courseDoc, batchDoc, stub } = await vi.hoisted(async () => {
	const { defineComponent, reactive } = await import('vue')
	return {
		stub: (name: string) => ({
			default: defineComponent({
				name,
				props: ['breadcrumbs'],
				template: '<div />',
			}),
		}),
		pageMeta: { current: null as null | (() => { title: string }) },
		courseDoc: reactive({ title: '' }),
		batchDoc: reactive({ title: '' }),
	}
})

vi.mock('frappe-ui', () => ({
	Badge: { template: '<span><slot /></span>' },
	usePageMeta: (meta: () => { title: string }) => (pageMeta.current = meta),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/composables/useCourseDraft', () => ({
	chaptersToCreate: () => [],
	useCourseDraft: () => ({ resource: { doc: courseDoc } }),
}))
vi.mock('@/pages/Batches/composables/useBatchDraft', () => ({
	useBatchDraft: () => ({ doc: ref(batchDoc) }),
}))
vi.mock('@/composables/formTracking', () => ({
	filledFields: () => [],
	takeFormSource: () => '',
}))
vi.mock('@/composables/useKeyboardShortcuts', () => ({
	saveShortcut: () => ({}),
	useKeyboardShortcuts: () => {},
}))
vi.mock('@/utils', () => ({ canCreateCourse: () => true }))
vi.mock('@/utils/onboarding', () => ({ seesOnboarding: () => false }))
vi.mock('@/composables/useUnsavedChangesGuard', () => ({
	useUnsavedChangesGuard: vi.fn(),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => stub('PageHeader'))
vi.mock('@/components/Courses/CourseSaveButton.vue', () => stub('Save'))
vi.mock('@/components/InlineEdit/DraftBanner.vue', () => stub('Banner'))
vi.mock('@/components/InlineEdit/DraftPageActions.vue', () => stub('Actions'))
vi.mock('@/pages/Courses/CourseOverview.vue', () => stub('Overview'))
vi.mock('@/pages/Batches/BatchOverview.vue', () => stub('Overview'))
vi.mock('@/pages/Batches/components/BatchSaveButton.vue', () => stub('Save'))
vi.stubGlobal('__', (text: string) => text)

import NewBatchPage from '@/pages/Batches/NewBatchPage.vue'
import NewCoursePage from '@/pages/Courses/NewCoursePage.vue'

const labels = (wrapper: ReturnType<typeof mount>) =>
	(
		wrapper.getComponent({ name: 'PageHeader' }).props('breadcrumbs') as {
			label: string
		}[]
	).map((crumb) => crumb.label)

const user = { data: { name: 'jane@example.com', is_moderator: 1 } }

describe.each([
	{ page: NewCoursePage, doc: courseDoc, list: 'Courses', noun: 'course' },
	{ page: NewBatchPage, doc: batchDoc, list: 'Batches', noun: 'batch' },
])('the new $noun page header', ({ page, doc, list, noun }) => {
	beforeEach(() => {
		doc.title = ''
	})

	it('names the draft only once it has a title, live as it is typed', async () => {
		const wrapper = mount(page, {
			global: { provide: { $user: user }, mocks: { __: globalThis.__ } },
		})
		expect(labels(wrapper)).toEqual([list])
		expect(pageMeta.current!().title).toBe(`New ${noun}`)

		doc.title = ' Intro '
		await nextTick()
		expect(labels(wrapper)).toEqual([list, 'Intro'])
		expect(pageMeta.current!().title).toBe('Intro')

		doc.title = ''
		await nextTick()
		expect(labels(wrapper)).toEqual([list])
	})
})
