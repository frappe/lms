import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ChooseMoment from '@/components/Goals/moments/ChooseMoment.vue'
import { seededOrder } from '@/utils/shuffle'
import { countsAsReply } from '@/utils/goals'
import { turnPause } from '@/composables/useVoice'

describe('seeded order', () => {
	it('is the same for the same seed and covers every position', () => {
		const order = seededOrder(5, 'Where does each one go?')
		expect(seededOrder(5, 'Where does each one go?')).toEqual(order)
		expect([...order].sort()).toEqual([0, 1, 2, 3, 4])
	})

	it('does not keep the last option last for most exercises', () => {
		const lastStaysLast = Array.from({ length: 60 }, (_, i) =>
			seededOrder(3, `question ${i}`)
		).filter((order) => order[2] === 2).length
		expect(lastStaysLast).toBeLessThan(35)
	})
})

describe('choose moment', () => {
	const moment = {
		kind: 'choose',
		prompt: 'A client asks what the quality policy commits to. What do you do?',
		options: [
			{ text: 'Answer from memory', correct: false, why: 'It may be wrong.' },
			{ text: 'Check the Quality Manual', correct: true, why: 'It is the source.' },
			{ text: 'Ask the client to wait a week', correct: false, why: 'Too slow.' },
		],
	}

	it('reports the option the learner tapped, wherever it is shown', async () => {
		const wrapper = mount(ChooseMoment, {
			props: { moment },
			global: { mocks: { __: (globalThis as any).__ } },
		})
		const right = wrapper
			.findAll('button')
			.find((b) => b.text().includes('Check the Quality Manual'))!
		await right.trigger('click')
		await wrapper
			.findAll('button')
			.find((b) => b.text() === 'Check')!
			.trigger('click')
		const result = wrapper.emitted('answer')![0][0] as any
		expect(result).toMatchObject({ correct: true, picked: 1 })
	})

	it('names only a wrong pick, never the right option', async () => {
		const wrapper = mount(ChooseMoment, {
			props: { moment, result: { picked: 0 } },
			global: { mocks: { __: (globalThis as any).__ } },
		})
		expect(wrapper.text()).toContain('Your pick')
		expect(wrapper.text()).not.toContain('Best choice')
	})
})

describe('turn pause', () => {
	it('waits longer when the words stop mid-thought or only a few have come', () => {
		expect(turnPause('I usually log it in the tracker and')).toBe(3000)
		expect(turnPause('yes so')).toBe(3000)
		expect(turnPause('I log every complaint in the tracker.')).toBe(1600)
	})
})

describe('role-play replies', () => {
	it('counts answers, not greetings or requests to repeat', () => {
		expect(countsAsReply('thanks for making time')).toBe(false)
		expect(countsAsReply('can you please repeat your question')).toBe(false)
		expect(
			countsAsReply('I log the complaint and fix the root cause myself')
		).toBe(true)
	})
})

describe('one question at a time', () => {
	it('holds back everything from the sentence with the first question', async () => {
		const { beforeQuestion } = await import('@/utils/goals')
		expect(beforeQuestion('Good catch. Where is it logged? Who signed?')).toBe(
			'Good catch.'
		)
		expect(beforeQuestion('Where is it logged?')).toBe('')
		expect(beforeQuestion('No question here.')).toBe('No question here.')
	})
})
