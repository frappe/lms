/**
 * Skeletons on the program, job and billing pages: each section shows its
 * skeleton until its own resource has data, drops it when the data lands, and
 * does not bring it back for a refetch that keeps the data on screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

vi.stubGlobal('__', (text: string) =>
	/{\d+}/.test(text)
		? {
				format: (...args: string[]) =>
					text.replace(/{(\d+)}/g, (_, i) => args[Number(i)]),
		  }
		: text
)

type Fake = {
	url?: string
	doctype?: string
	data: unknown
	doc: unknown
	error: unknown
	loading: boolean
	list: { loading: boolean }
	get: { loading: boolean; error: unknown }
	submit: () => void
	fetch: () => void
	reload: () => void
	update: () => void
	abort: () => void
}

const { resources } = vi.hoisted(() => ({ resources: [] as Fake[] }))

const fake = (options: Record<string, any>, extra = {}) => {
	const resource = reactive({
		url: options.url,
		doctype: options.doctype,
		data: null,
		doc: null,
		error: null,
		loading: Boolean(options.auto),
		list: { loading: Boolean(options.auto) },
		get: { loading: Boolean(options.auto), error: null },
		submit() {
			resource.loading = true
		},
		fetch() {
			resource.loading = true
		},
		reload() {
			resource.loading = true
			resource.list.loading = true
		},
		update() {},
		abort() {},
		...extra,
	}) as Fake
	resources.push(resource)
	return resource
}

const byUrl = (part: string) =>
	resources.find((r) => (r.url || r.doctype || '').includes(part)) as Fake

const passthrough = { template: '<div><slot /></div>' }

vi.mock('frappe-ui', () => ({
	createResource: (options: Record<string, any>) => fake(options),
	createListResource: (options: Record<string, any>) => fake(options),
	createDocumentResource: (options: Record<string, any>) =>
		options.name ? fake(options) : undefined,
	usePageMeta: () => {},
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	call: vi.fn(() => Promise.resolve()),
	Avatar: { template: '<i />' },
	Badge: passthrough,
	Tooltip: passthrough,
	Alert: { template: '<i />' },
	Button: { template: '<button><slot /></button>' },
	FormControl: { template: '<input />' },
	Combobox: { template: '<input />' },
	TabButtons: { template: '<i />' },
	Dialog: passthrough,
	Dropdown: passthrough,
}))
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useRoute: () => ({ query: {} }),
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: {
		props: ['loading'],
		template:
			'<header :data-loading="String(Boolean(loading))"><slot name="actions" /></header>',
	},
}))
vi.mock('@/components/Layouts/pages/PageBody.vue', () => ({
	default: { template: '<main><h1><slot name="name" /></h1><slot /></main>' },
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: { props: ['label'], template: '<button>{{ label }}</button>' },
}))
vi.mock('@/components/Modals/JobApplicationModal.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/CourseCard.vue', () => ({
	default: { template: '<article class="course-card" />' },
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: { template: '<input />' },
}))
vi.mock('@/components/NotPermitted.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/composables/useStudentView', () => ({
	studentViewMode: () => false,
}))
vi.mock('@/composables/useFormRoute', () => ({ openFormRoute: vi.fn() }))
vi.mock('@/utils', () => ({ convertToTitleCase: (text: string) => text }))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('frappe-ui/experimental', () => ({ InputLabel: { template: '<i />' } }))
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: {
		props: ['loading', 'rows'],
		template:
			'<section :data-loading="String(loading)"><h1><slot name="name" /></h1></section>',
	},
}))

const user = { data: { name: 'learner@example.com' } }
const mountPage = (component: any, props = {}) =>
	mount(component, {
		props,
		global: {
			provide: { $user: user },
			mocks: { __: globalThis.__ },
			directives: { safeHtml: {}, external: {} },
			stubs: { 'router-link': true },
		},
	})

beforeEach(() => {
	resources.length = 0
})

describe('StudentPrograms', () => {
	it('shows program card skeletons until the programs land, and not on refetch', async () => {
		const { default: Page } = await import(
			'@/pages/Programs/StudentPrograms.vue'
		)
		const wrapper = mountPage(Page)
		const programs = byUrl('get_programs')
		expect(wrapper.find('[data-testid="program-skeletons"]').exists()).toBe(
			true
		)

		programs.data = { enrolled: [], published: [] }
		programs.loading = false
		await nextTick()
		expect(wrapper.find('[data-testid="program-skeletons"]').exists()).toBe(
			false
		)

		programs.loading = true
		await nextTick()
		expect(wrapper.find('[data-testid="program-skeletons"]').exists()).toBe(
			false
		)
	})
})

describe('ProgramDetail', () => {
	it('holds the title and course grid with skeletons until the program lands', async () => {
		const { default: Page } = await import('@/pages/Programs/ProgramDetail.vue')
		const wrapper = mountPage(Page, { programName: 'path' })
		const program = byUrl('get_program_details')
		expect(wrapper.find('[data-testid="program-skeleton"]').exists()).toBe(true)
		expect(
			wrapper.find('[data-testid="program-title-skeleton"]').exists()
		).toBe(true)

		program.data = {
			name: 'path',
			is_member: true,
			courses: [{ name: 'c1', eligible: true }],
		}
		program.loading = false
		await nextTick()
		expect(wrapper.find('[data-testid="program-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.findAll('.course-card')).toHaveLength(1)

		program.loading = true
		await nextTick()
		expect(wrapper.find('[data-testid="program-skeleton"]').exists()).toBe(
			false
		)
		expect(
			wrapper.find('[data-testid="program-title-skeleton"]').exists()
		).toBe(false)
	})
})

describe('JobDetail', () => {
	it('shows the header and body skeletons only before the job lands', async () => {
		const { default: Page } = await import('@/pages/JobDetail.vue')
		const wrapper = mountPage(Page, { job: 'job-1' })
		const job = byUrl('get_job_details')
		expect(wrapper.find('[data-testid="job-detail-skeleton"]').exists()).toBe(
			true
		)
		expect(wrapper.get('header').attributes('data-loading')).toBe('true')

		job.data = { name: 'job-1', job_title: 'Engineer', creation: '2026-01-01' }
		job.loading = false
		await nextTick()
		expect(wrapper.find('[data-testid="job-detail-skeleton"]').exists()).toBe(
			false
		)

		job.loading = true
		await nextTick()
		expect(wrapper.find('[data-testid="job-detail-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.get('header').attributes('data-loading')).toBe('false')
	})

	it('holds the Apply button until the application check answers', async () => {
		const { default: Page } = await import('@/pages/JobDetail.vue')
		const wrapper = mountPage(Page, { job: 'job-1' })
		const job = byUrl('get_job_details')
		job.data = { name: 'job-1', job_title: 'Engineer', creation: '2026-01-01' }
		job.loading = false
		await nextTick()
		expect(wrapper.find('[data-testid="apply-skeleton"]').exists()).toBe(true)
		expect(wrapper.text()).not.toContain('Apply')

		byUrl('frappe.client.get_list').data = []
		await nextTick()
		expect(wrapper.find('[data-testid="apply-skeleton"]').exists()).toBe(false)
		expect(wrapper.text()).toContain('Apply')
	})
})

describe('Billing', () => {
	it('shows its skeleton through the access check and the order summary', async () => {
		const { default: Page } = await import('@/pages/Billing.vue')
		const wrapper = mountPage(Page, { type: 'course', name: 'paid' })
		const skeleton = () => wrapper.find('[data-testid="billing-skeleton"]')
		expect(skeleton().exists()).toBe(true)

		byUrl('validate_billing_access').data = { access: true }
		await nextTick()
		expect(skeleton().exists()).toBe(true)

		const summary = byUrl('get_order_summary')
		summary.data = { title: 'Paid course', total_amount_formatted: '$10' }
		await nextTick()
		expect(skeleton().exists()).toBe(false)

		summary.loading = true
		await nextTick()
		expect(skeleton().exists()).toBe(false)
	})

	it('drops the skeleton for a refusal instead of waiting on a summary', async () => {
		const { default: Page } = await import('@/pages/Billing.vue')
		const wrapper = mountPage(Page, { type: 'course', name: 'paid' })
		byUrl('validate_billing_access').data = {
			access: false,
			message: 'Already enrolled',
		}
		await nextTick()
		expect(wrapper.find('[data-testid="billing-skeleton"]').exists()).toBe(
			false
		)
	})
})

describe('JobApplications', () => {
	it('shows a count skeleton in the heading until the count lands', async () => {
		const { default: Page } = await import('@/pages/JobApplications.vue')
		const wrapper = mount(Page, {
			props: { job: 'job-1' },
			global: {
				provide: { $user: user, $dayjs: () => ({ format: () => '' }) },
				mocks: { __: globalThis.__ },
			},
		})
		await flushPromises()
		// The list resource's flag lives on `.list`; `.loading` is undefined.
		expect(wrapper.get('section').attributes('data-loading')).toBe('true')
		const skeleton = () =>
			wrapper.find('[data-testid="application-count-skeleton"]')
		expect(skeleton().exists()).toBe(true)

		byUrl('frappe.client.get_count').data = 3
		await nextTick()
		expect(skeleton().exists()).toBe(false)
		expect(wrapper.text()).toContain('3 applications')
	})
})
