import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const german: Record<string, string> = {
	Quiz: 'Test',
	Assignment: 'Aufgabe',
	'Programming Exercise': 'Programmieraufgabe',
}
vi.stubGlobal('__', (text: string) => german[text] ?? text)

vi.mock('frappe-ui', () => ({
	createResource: () => ({ loading: false }),
	getCachedResource: vi.fn(),
	toast: {},
	FormControl: { name: 'FormControl', props: ['options'], template: '<i />' },
}))
vi.mock('vue-router', () => ({
	useRoute: () => ({ hash: '' }),
	useRouter: () => ({}),
}))
vi.mock('@/composables/useFormRoute', () => ({
	useFormRoute: () => ({ close: vi.fn(), saveAndReplace: vi.fn() }),
}))
vi.mock('@/composables/useBatchForms', () => ({ batchRouteLocation: vi.fn() }))
vi.mock('@/utils/resource', () => ({ submitResource: vi.fn() }))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/FormShell.vue', () => ({
	default: { template: '<div><slot /><slot name="actions" /></div>' },
}))

import AssessmentForm from '@/pages/Forms/AssessmentForm.vue'

describe('AssessmentForm type picker', () => {
	// Regression: type labels stayed English in every language (#3025, fixed in #3045).
	it('translates the labels and keeps the doctype values', () => {
		const wrapper = mount(AssessmentForm, {
			props: { batchName: 'B1' },
			global: {
				provide: { $user: { data: { is_moderator: true } } },
				mocks: { __: (text: string) => german[text] ?? text },
			},
		})
		expect(
			wrapper.findComponent({ name: 'FormControl' }).props('options')
		).toEqual([
			{ label: 'Test', value: 'LMS Quiz' },
			{ label: 'Aufgabe', value: 'LMS Assignment' },
			{ label: 'Programmieraufgabe', value: 'LMS Programming Exercise' },
		])
	})
})
