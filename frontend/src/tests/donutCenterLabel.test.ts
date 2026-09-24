import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import ProgramProgressSummary from '@/components/Programs/ProgramProgressSummary.vue'
import Statistics from '@/pages/Statistics.vue'

const resourceData = vi.hoisted<Record<string, unknown>>(() => ({
	'lms.lms.utils.get_course_completion_data': [
		{ label: 'Completed', value: 3 },
		{ label: 'In Progress', value: 5 },
	],
	'lms.lms.api.get_chart_details': {},
}))

vi.mock('frappe-ui', async (importOriginal) => ({
	...(await importOriginal<typeof import('frappe-ui')>()),
	usePageMeta: () => {},
	createResource: (options: any) => ({
		loading: false,
		data: resourceData[options.url] ?? null,
	}),
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: {} }),
}))
vi.mock('../stores/session', () => ({
	sessionStore: () => ({ brand: {} }),
}))

enableAutoUnmount(afterEach)

const translate = (text: string) =>
	Object.assign(`tr:${text}`, { format: () => `tr:${text}` })
vi.stubGlobal('__', translate)
vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
)

describe('DonutChart centre caption', () => {
	it('ProgramProgressSummary captions the total with a translated label', async () => {
		const w = mount(ProgramProgressSummary, {
			props: {
				modelValue: true,
				programName: 'P',
				programMembers: [
					{ name: 'a', full_name: 'A', progress: 10 },
					{ name: 'b', full_name: 'B', progress: 50 },
				] as any,
			},
			global: {
				mocks: { __: translate },
				stubs: {
					Dialog: { template: '<div><slot /></div>' },
					ResponsiveListView: true,
					FormControl: true,
					NumberCard: true,
				},
			},
		})
		await flushPromises()
		const text = w.text()
		expect(text).toContain('tr:Members')
		expect(text).not.toMatch(/\bCount\b/)
	})

	it('Statistics captions the completion donut total with a translated label', async () => {
		const w = mount(Statistics, {
			global: {
				mocks: { __: translate },
				stubs: { PageHeader: true, NumberCard: true, LineChart: true },
			},
		})
		await flushPromises()
		const text = w.text()
		expect(text).toContain('tr:Enrollments')
		expect(text).not.toMatch(/\bValue\b/)
	})
})
