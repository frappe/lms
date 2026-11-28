import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)
vi.mock('frappe-ui', () => ({
	Avatar: { template: '<span />' },
	createResource: () => ({ data: null, fetch: vi.fn(), submit: vi.fn() }),
}))
vi.mock('@/components/Controls/MultiLink.vue', () => ({
	default: { name: 'MultiLink', template: '<div />' },
}))
vi.mock('@/components/Modals/NewMemberModal.vue', () => ({
	default: { name: 'NewMemberModal', template: '<div />' },
}))

import InstructorsField from '@/components/InlineEdit/InstructorsField.vue'

describe('the instructors field', () => {
	// It renders the picker and its member modal side by side, so a parent's
	// class would otherwise be dropped.
	it('passes a parent class to the picker', () => {
		const picker = mount(InstructorsField, {
			props: { modelValue: [], memberRole: 'course_creator' },
			attrs: { class: '-mx-2' },
			global: { mocks: { __: (text: string) => text } },
		}).getComponent({ name: 'MultiLink' })
		expect(picker.classes()).toEqual(
			expect.arrayContaining(['-mx-2', 'rounded-4'])
		)
	})

	it('searches the roles it is given, course creators and evaluators by default', () => {
		const searchedRoles = (roles?: string[]) => {
			const picker = mount(InstructorsField, {
				props: { modelValue: [], memberRole: 'batch_evaluator', roles },
				global: { mocks: { __: (text: string) => text } },
			}).getComponent({ name: 'MultiLink' })
			const params = picker.vm.$attrs.searchParams as { roles: string }
			return JSON.parse(params.roles)
		}
		expect(searchedRoles()).toEqual(['Course Creator', 'Batch Evaluator'])
		expect(searchedRoles(['Moderator', 'Course Creator'])).toEqual([
			'Moderator',
			'Course Creator',
		])
	})
})
