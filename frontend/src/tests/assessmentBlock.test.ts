// Guards the lesson embed wrapper: login gate, embedded flag, Student View.
// Came with this branch's one-helper mount for assessment blocks.
// Added on feat/assessment-visual-redesign to cover the wrapper every block uses.
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject } from 'vue'
import { mount } from '@vue/test-utils'
import AssessmentBlock from '@/components/Assessment/AssessmentBlock.vue'

vi.mock('frappe-ui', () => ({
	Button: defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('button', slots.default?.()),
	}),
}))

const Child = defineComponent({
	props: {
		assignmentID: { type: String, required: true },
		embedded: { type: Boolean, default: false },
	},
	setup(props) {
		const user = inject<{ data: { is_moderator: boolean } }>('$user')
		return () =>
			h('div', {
				'data-testid': 'child',
				'data-id': props.assignmentID,
				'data-embedded': String(props.embedded),
				'data-moderator': String(user?.data.is_moderator),
			})
	},
})

const moderator = {
	data: { name: 'mod@example.com', is_moderator: true, roles: [] },
}

const mountBlock = (user: unknown, studentView = false) =>
	mount(AssessmentBlock, {
		props: { is: Child, props: { assignmentID: 'ASG-1' }, studentView },
		global: {
			provide: { $user: user },
			mocks: { __: (text: string) => text },
		},
	})

describe('AssessmentBlock', () => {
	it('asks a visitor to log in instead of rendering the block', () => {
		const wrapper = mountBlock({ data: null })

		expect(wrapper.find('[data-testid="child"]').exists()).toBe(false)
		expect(wrapper.text()).toContain('Please login to continue.')
		expect(wrapper.find('button').text()).toBe('Login')
	})

	it('renders the block with its props, marked as embedded', () => {
		const child = mountBlock(moderator).get('[data-testid="child"]')

		expect(child.attributes('data-id')).toBe('ASG-1')
		expect(child.attributes('data-embedded')).toBe('true')
		expect(child.attributes('data-moderator')).toBe('true')
	})

	it('shows the block as a learner sees it in Student View', () => {
		const child = mountBlock(moderator, true).get('[data-testid="child"]')

		expect(child.attributes('data-moderator')).toBe('false')
	})
})
