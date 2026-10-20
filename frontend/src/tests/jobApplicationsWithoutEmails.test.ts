/**
 * A job poster sees applicants by name, never by address: the applicants come
 * back keyed by application, and the email goes out from the server.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { resources, lists } = vi.hoisted(() => ({
	resources: { value: [] as any[] },
	lists: { value: [] as any[] },
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (config: any) => {
			const res: any = reactive({
				config,
				data: null,
				submit: vi.fn(),
				reload: vi.fn(),
			})
			resources.value.push(res)
			return res
		},
		createListResource: (config: any) => {
			const res: any = {
				config,
				data: [
					{
						name: 'APP-1',
						creation: '2026-10-01',
						resume: null,
						job_title: 'Engineer',
					},
				],
				update: vi.fn(),
				reload: vi.fn(),
			}
			lists.value.push(res)
			return res
		},
		usePageMeta: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		Avatar: { template: '<span />' },
		Button: { template: '<button><slot /></button>' },
		Dialog: { template: '<div><slot name="body-content" /></div>' },
		Dropdown: { template: '<div />' },
		FormControl: { template: '<input />' },
	}
})

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

vi.mock('@/components/Layouts/ListPage.vue', () => ({
	default: { props: ['rows', 'columns'], template: '<div />' },
}))

vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<div />' },
}))

// Mirrors setup.ts's translate(): a string, or `.format` when it has slots.
const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (_m, i) => String(args[Number(i)])),
	}
}

const findResource = (url: string) =>
	resources.value.find((r) => r.config.url === url)

const mountPage = async () =>
	mount(
		// @ts-expect-error a JS SFC has no generated types (TS7016), as in announcementForm.test.ts.
		(await import('@/pages/JobApplications.vue')).default,
		{
			props: { job: 'JOB-1' },
			global: {
				provide: { $dayjs: () => ({ format: () => '01 Oct 2026' }) },
				mocks: { __: translate },
			},
		}
	)

describe('JobApplications without applicant emails', () => {
	beforeEach(() => {
		vi.stubGlobal('__', translate)
		resources.value = []
		lists.value = []
	})

	it('never asks the generic list for the applicant user', async () => {
		await mountPage()
		expect(lists.value[0].config.fields).not.toContain('user')
	})

	it('looks applicants up by application name', async () => {
		await mountPage()
		const users = findResource('lms.lms.api.get_application_users')
		expect(users.config.makeParams()).toEqual({ applications: ['APP-1'] })
	})

	it('joins the applicant details on the application', async () => {
		const wrapper = await mountPage()
		findResource('lms.lms.api.get_application_users').data = [
			{ application: 'APP-1', username: 'sam', full_name: 'Sam Stud' },
		]
		await flushPromises()
		const ListPage = (await import('@/components/Layouts/ListPage.vue')).default
		const rows = wrapper.findComponent(ListPage as any)
		const columns = rows.props('columns').map((c: any) => c.key)
		expect(rows.props('rows')[0].full_name).toBe('Sam Stud')
		expect(columns).not.toContain('email')
	})

	it('sends the email through the server, naming only the application', async () => {
		await mountPage()
		const send = findResource('lms.lms.api.send_job_application_email')
		expect(send).toBeTruthy()
		expect(findResource('frappe.core.doctype.communication.email.make')).toBe(
			undefined
		)
	})
})
