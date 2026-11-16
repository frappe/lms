// Guards #3013: a company logo that fails to load left a broken image with its
// alt text squeezed into the 40px box.
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const stub = vi.hoisted(() => (name: string) => ({
	name,
	template: '<div><slot /></div>',
}))

vi.mock('frappe-ui', async (importOriginal) => {
	const { reactive } = await import('vue')
	return {
		...(await importOriginal<typeof import('frappe-ui')>()),
		createResource: (config: { url: string }) =>
			reactive({
				data:
					config.url === 'lms.lms.api.get_job_details'
						? {
								name: 'JOB-1',
								job_title: 'Engineer',
								company_name: 'Test',
								company_logo: '/files/missing.png',
								company_website: 'https://example.com',
						  }
						: null,
				loading: false,
				submit: vi.fn(),
			}),
		usePageMeta: vi.fn(),
	}
})
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: stub('PageHeader'),
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: stub('HeaderButton'),
}))
vi.mock('@/components/Modals/JobApplicationModal.vue', () => ({
	default: stub('JobApplicationModal'),
}))

import JobDetail from '@/pages/JobDetail.vue'

const mountJob = async () => {
	const wrapper = mount(JobDetail, {
		props: { job: 'JOB-1' },
		global: {
			provide: {
				$user: { data: null },
				$dayjs: () => ({ fromNow: () => 'today' }),
			},
			directives: { external: {}, 'safe-html': {} },
		},
	})
	await flushPromises()
	return wrapper
}

describe('job detail company logo', () => {
	it('shows the logo while it loads', async () => {
		const wrapper = await mountJob()

		expect(wrapper.get('img').attributes('src')).toBe('/files/missing.png')
	})

	it('falls back to the company initial when the logo fails', async () => {
		const wrapper = await mountJob()

		await wrapper.get('img').trigger('error')

		expect(wrapper.find('img').exists()).toBe(false)
		expect(wrapper.get('a').text()).toBe('T')
		expect(wrapper.get('a').attributes('aria-label')).toBe('Test')
	})
})
