import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.stubGlobal('__', (text: string) => text)
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return args.reduce<string>(
		(out, arg, i) => out.replaceAll(`{${i}}`, String(arg)),
		this
	)
}

vi.mock('frappe-ui', () => ({
	createResource: () =>
		reactive({
			data: [
				{
					name: 'C1',
					title: 'Course one',
					lessons: 3,
					membership: { progress: 40 },
				},
			],
			abort: () => {},
			reload: () => {},
		}),
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Button: { template: `<button><slot /></button>` },
}))
vi.mock('@/components/ProgressBar.vue', () => ({
	default: { template: '<div class="progress" />' },
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))
vi.mock('@/components/InlineEdit/InlinePicker.vue', () => ({
	default: { template: '<div />' },
}))

import BatchCourseList from '@/pages/Batches/components/overview/BatchCourseList.vue'

const mountList = async (hideProgress: boolean) => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: {} },
			{ path: '/courses/:courseName', name: 'CourseDetail', component: {} },
		],
	})
	await router.push('/')
	const wrapper = mount(BatchCourseList, {
		props: { batchName: 'B1', hideProgress },
		global: {
			plugins: [router],
			provide: { $user: { data: {} } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

describe('BatchCourseList in student view', () => {
	it('shows course progress to an enrolled viewer', async () => {
		const wrapper = await mountList(false)
		expect(wrapper.find('.progress').exists()).toBe(true)
		expect(wrapper.text()).toContain('40%')
	})

	it("hides the instructor's own progress in a not-enrolled preview", async () => {
		const wrapper = await mountList(true)
		expect(wrapper.find('.progress').exists()).toBe(false)
		expect(wrapper.text()).not.toContain('40%')
	})
})
