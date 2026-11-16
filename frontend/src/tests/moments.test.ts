import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import SortMoment from '@/components/Goals/moments/SortMoment.vue'
import MatchMoment from '@/components/Goals/moments/MatchMoment.vue'
import FillMoment from '@/components/Goals/moments/FillMoment.vue'
import ReplyMoment from '@/components/Goals/moments/ReplyMoment.vue'
import MomentBlock from '@/components/Goals/moments/MomentBlock.vue'

const mountWith = (component: any, moment: Record<string, unknown>) =>
	mount(component, {
		props: { moment, id: 'm1' },
		global: {
			stubs: { CharacterAvatar: { template: '<span />' } },
			mocks: { __: (globalThis as any).__ },
		},
	})

const buttons = (wrapper: any, text: string) =>
	wrapper.findAll('button').filter((b: any) => b.text() === text)

const answer = (wrapper: any) => wrapper.emitted('answer')?.[0]?.[0] as any

describe('sort moment', () => {
	const moment = {
		kind: 'sort',
		idea: 0,
		prompt: 'Where does each one go?',
		buckets: ['Report to the IC', 'Handle with your manager'],
		items: [
			{ text: 'A colleague keeps commenting on your clothes', bucket: 0 },
			{ text: 'Your shift was changed without notice', bucket: 1 },
		],
	}

	it('checks only once every item has a bucket and names what was misplaced', async () => {
		const wrapper = mountWith(SortMoment, moment)
		const check = buttons(wrapper, 'Check')[0]
		expect(check.attributes('disabled')).toBeDefined()

		await buttons(wrapper, 'Report to the IC')[0].trigger('click')
		await buttons(wrapper, 'Report to the IC')[1].trigger('click')
		expect(check.attributes('disabled')).toBeUndefined()
		await check.trigger('click')

		const result = answer(wrapper)
		expect(result.correct).toBe(false)
		expect(result.summary.wrong).toEqual([
			{
				item: 'Your shift was changed without notice',
				theirs: 'Report to the IC',
				right: 'Handle with your manager',
			},
		])
	})
})

describe('match moment', () => {
	const moment = {
		kind: 'match',
		idea: 1,
		prompt: 'Who has how long?',
		pairs: [
			{ left: 'The employer acts', right: 'One month' },
			{ left: 'Either side appeals', right: '90 days' },
		],
	}

	it('fills the tapped row, then the next empty one, and reports the wrong pair', async () => {
		const wrapper = mountWith(MatchMoment, moment)
		await buttons(wrapper, '90 days')[0].trigger('click')
		await buttons(wrapper, 'One month')[0].trigger('click')
		await buttons(wrapper, 'Check')[0].trigger('click')

		const result = answer(wrapper)
		expect(result.correct).toBe(false)
		expect(result.matched).toEqual(['90 days', 'One month'])
		expect(result.summary.wrong).toHaveLength(2)
	})
})

describe('match moment with a repeated right side', () => {
	it('spends chips by position, so both rows can take the same answer', async () => {
		const wrapper = mountWith(MatchMoment, {
			kind: 'match',
			idea: 1,
			prompt: 'How long?',
			pairs: [
				{ left: 'Employer acts', right: 'One month' },
				{ left: 'IC replies', right: 'One month' },
			],
		})
		const chips = buttons(wrapper, 'One month')
		expect(chips).toHaveLength(2)
		await chips[0].trigger('click')
		await chips[1].trigger('click')
		await buttons(wrapper, 'Check')[0].trigger('click')
		expect(answer(wrapper).correct).toBe(true)
	})
})

describe('fill moment', () => {
	const moment = {
		kind: 'fill',
		idea: 2,
		prompt: 'Complete the rule',
		text: 'A complaint goes to the IC within ___ of the incident, in ___.',
		answers: ['three months', 'writing'],
		extra_pieces: ['one month'],
	}

	it('shows one chip per blank and fills them in order', async () => {
		const wrapper = mountWith(FillMoment, moment)
		expect(wrapper.text()).toContain('A complaint goes to the IC within')
		await buttons(wrapper, 'three months')[0].trigger('click')
		await buttons(wrapper, 'writing')[0].trigger('click')
		await buttons(wrapper, 'Check')[0].trigger('click')

		const result = answer(wrapper)
		expect(result.correct).toBe(true)
		expect(result.filled).toEqual(['three months', 'writing'])
	})
})

describe('reply moment', () => {
	const moment = {
		kind: 'reply',
		idea: 0,
		prompt: 'Quilla asks you this in the corridor. What do you say?',
		message: 'Who complained about Tavish? Everyone is talking.',
		cast: 'quilla',
		criteria: ['Keeps the names private', 'Points her to the IC'],
	}

	it('sends their words without a verdict once there are a few of them', async () => {
		const wrapper = mountWith(ReplyMoment, moment)
		expect(wrapper.text()).toContain('Quilla')
		const send = buttons(wrapper, 'Send')[0]
		expect(send.attributes('disabled')).toBeDefined()

		await wrapper
			.find('textarea')
			.setValue(
				"I can't share that. If you're worried, the IC is the place to go.",
			)
		expect(send.attributes('disabled')).toBeUndefined()
		await send.trigger('click')

		const result = answer(wrapper)
		expect(result.correct).toBeNull()
		expect(result.summary.criteria).toEqual(moment.criteria)
		expect(result.their_words).toContain('the IC is the place')
	})

	it('shows a neutral badge in the block while the tutor reads it', () => {
		const wrapper = mount(MomentBlock, {
			props: {
				id: 'm1',
				moment,
				result: { correct: null, their_words: 'x y z' },
			},
			global: {
				stubs: { CharacterAvatar: { template: '<span />' } },
				mocks: { __: (globalThis as any).__ },
			},
		})
		expect(wrapper.text()).toContain('Sent')
		expect(wrapper.text()).not.toContain('Worth a second look')
	})
})
