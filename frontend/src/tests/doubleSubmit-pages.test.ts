/** Page actions that write must not run twice while the first is in flight. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { resources } = vi.hoisted(() => ({ resources: [] as any[] }))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (config: any) => {
			const resource: any = reactive({
				config,
				data: null,
				loading: false,
				finish: () => {},
				submit: vi.fn((_params: unknown, handlers: any = {}) => {
					resource.loading = true
					return new Promise<void>((resolve) => {
						resource.finish = () => {
							resource.loading = false
							handlers.onSuccess?.(null)
							resolve()
						}
					})
				}),
				reload: vi.fn(),
				fetch: vi.fn(),
			})
			resources.push(resource)
			return resource
		},
		createListResource: (config: any) =>
			reactive({
				config,
				data: [{ name: 'APP-1', job_title: 'Engineer' }],
				update: vi.fn(),
				reload: vi.fn(),
			}),
		call: vi.fn(() => Promise.resolve()),
		toast: { success: vi.fn(), error: vi.fn() },
		usePageMeta: vi.fn(),
		Avatar: { template: '<span />' },
		Button: {
			name: 'Button',
			props: ['loading'],
			template: '<button :data-loading="String(!!loading)"><slot /></button>',
		},
		Dialog: { name: 'Dialog', props: ['actions'], template: '<div />' },
		Dropdown: { template: '<div />' },
		FormControl: { template: '<input />' },
	}
})

vi.mock('frappe-ui/experimental', () => ({
	InputLabel: { template: '<label />' },
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
vi.mock('@/stores/sidebar', () => ({
	useSidebar: () => ({ isSidebarCollapsed: false }),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<div />' },
}))

const translate = (message: string) =>
	/{\d+}/.test(message)
		? { format: (...args: unknown[]) => `${message} ${args.join(' ')}` }
		: message

const findResource = (url: string) =>
	resources.find((resource) => resource.config.url === url)

beforeEach(() => {
	vi.stubGlobal('__', translate)
	resources.length = 0
})

describe('SCORMChapter enrol', () => {
	const mountChapter = async () => {
		const wrapper = mount(
			// @ts-expect-error a JS SFC has no generated types (TS7016).
			(await import('@/pages/SCORMChapter.vue')).default,
			{
				props: { courseName: 'COURSE-1', chapterName: 'CH-1' },
				global: {
					mocks: { __: translate },
					provide: { $user: { data: { name: 'student@example.com' } } },
				},
			}
		)
		const playback = findResource(
			'lms.lms.doctype.course_chapter.course_chapter.get_scorm_playback'
		)
		playback.data = {
			lesson: 'L-1',
			locked: 0,
			can_access: 0,
			launch_file: null,
		}
		await flushPromises()
		return wrapper
	}

	it('inserts one enrollment however often Start Learning fires', async () => {
		const wrapper = await mountChapter()
		const button = wrapper.find('button')
		expect(button.text()).toContain('Start Learning')

		await button.trigger('click')
		await button.trigger('click')
		;(wrapper.vm as any).enrollStudent()

		const enrollment = findResource('frappe.client.insert')
		expect(enrollment.submit).toHaveBeenCalledTimes(1)
		expect(wrapper.find('button').attributes('data-loading')).toBe('true')
		wrapper.unmount()
	})
})

describe('JobApplications send email', () => {
	it('keeps the Send action pending until the email is sent', async () => {
		const wrapper = mount(
			// @ts-expect-error a JS SFC has no generated types (TS7016).
			(await import('@/pages/JobApplications.vue')).default,
			{
				props: { job: 'JOB-1' },
				global: {
					provide: { $dayjs: () => ({ format: () => '01 Oct 2026' }) },
					mocks: { __: translate },
				},
			}
		)
		const vm = wrapper.vm as any
		vm.openEmailModal({ name: 'APP-1', full_name: 'Sam' })
		vm.emailForm.message = 'Hello'
		await flushPromises()

		const close = vi.fn()
		const dialog = wrapper.findComponent({ name: 'Dialog' })
		let settled = false
		const pending = dialog
			.props('actions')[0]
			.onClick({ close })
			.then(() => (settled = true))
		await flushPromises()
		expect(settled).toBe(false)
		expect(close).not.toHaveBeenCalled()

		findResource('lms.lms.api.send_job_application_email').finish()
		await pending
		expect(close).toHaveBeenCalledTimes(1)
		wrapper.unmount()
	})
})
