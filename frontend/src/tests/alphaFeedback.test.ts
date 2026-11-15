import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const call = vi.hoisted(() => vi.fn(() => Promise.resolve(null)))

vi.mock('frappe-ui', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	call,
}))

import FinishStep from '@/components/Goals/steps/FinishStep.vue'

const ready = {
	goal: {
		title: 'Fire Alarm Response',
		outcome: 'By the end, you will leave calmly.',
	},
	assignment: { name: 'ASG-1', status: 'Ready', score: 86 },
	requirements: { mastery: true, acknowledgement: true, sign_off: true },
	memberName: 'Jane Smith',
	activities: [{ title: 'Fire alarm check', done: true }],
	ideas: [],
}

const mountWith = (props: Record<string, unknown>) =>
	mount(FinishStep, {
		props,
		global: {
			stubs: {
				CharacterAvatar: { template: '<span />' },
				Dialog: { template: '<div />' },
			},
			mocks: { __: (globalThis as any).__ },
		},
	})

beforeEach(() => call.mockClear())

describe('alpha feedback on the finish page', () => {
	it('asks only once the skill is finished', () => {
		const notReady = mountWith({
			...ready,
			assignment: { name: 'ASG-1', status: 'In Progress', score: 40 },
			activities: [{ title: 'Fire alarm check', done: false }],
		})
		expect(notReady.text()).not.toContain('first people to learn this way')
		expect(mountWith(ready).text()).toContain('first people to learn this way')
	})

	it('sends the answers as the words shown and then says thank you', async () => {
		const wrapper = mountWith(ready)
		const send = wrapper.findAll('button').find((b) => b.text() === 'Submit')!
		expect(send.attributes('disabled')).toBeDefined()

		await wrapper
			.findAll('button')
			.find((b) => b.text() === 'Right idea, rough edges')!
			.trigger('click')
		await wrapper
			.findAll('.rating-stars')[2]
			.findAll('.rating-star')[2]
			.trigger('click')
		await wrapper
			.findAll('button')
			.find((b) => b.text() === 'Too slow')!
			.trigger('click')
		expect(send.attributes('disabled')).toBeUndefined()

		await send.trigger('click')
		await flushPromises()

		expect(call).toHaveBeenCalledWith(
			'lms.lms.ai.api.submit_alpha_feedback',
			expect.objectContaining({
				assignment: 'ASG-1',
				values: expect.objectContaining({
					future: 'Right idea, rough edges',
					voices: 3,
					voice_notes: 'Too slow',
				}),
			}),
		)
		expect(wrapper.text()).toContain(
			'Thank you. Your answers are with the Frappe Learning team.',
		)
	})

	it('shows the thank-you line instead of the form when answers already exist', () => {
		const wrapper = mountWith({ ...ready, feedbackGiven: true })
		expect(wrapper.text()).toContain('Thank you')
		expect(wrapper.findAll('button').some((b) => b.text() === 'Submit')).toBe(
			false,
		)
	})
})
