/**
 * utils/oneQuestion: the page's copy of lms/lms/ai/one_question.py. The examples are the ones
 * test_one_question.py checks, so the page and the server hold a turn to the same question.
 */
import { describe, expect, it } from 'vitest'
import {
	oneAsk,
	shownTurn,
	streamingShown,
	withoutNarration,
	withoutQuestions,
} from '@/utils/oneQuestion'

describe('one question per turn', () => {
	it('keeps only the first ask', () => {
		expect(oneAsk('Fine. So which system did you log it in, and what is the reference?')).toBe(
			'Fine. So which system did you log it in?'
		)
		expect(oneAsk('What is the ticket number? And what date was it logged?')).toBe(
			'What is the ticket number?'
		)
		const eitherOr = 'Do you fix it yourself, or does someone else decide?'
		expect(oneAsk(eitherOr)).toBe(eitherOr)
	})

	it('leaves a turn with one question alone', () => {
		expect(shownTurn(['Good catch. Where would you look first?'])).toEqual([
			'Good catch. Where would you look first?',
		])
		expect(shownTurn(['Where would you look first? Take your time.'])).toEqual([
			'Where would you look first? Take your time.',
		])
	})

	it('cuts a joined ask and stops at the first question', () => {
		expect(shownTurn(['Fine. Which system did you log it in, and what is the reference?'])).toEqual([
			'Fine. Which system did you log it in?',
		])
		expect(shownTurn(['Right. Where is it logged? Who signed it off?'])).toEqual([
			'Right. Where is it logged?',
		])
	})

	it('takes the question out of a later message in the turn', () => {
		expect(shownTurn(['Good. Where did you log it?', 'Noted. And who checked your fix?'])).toEqual([
			'Good. Where did you log it?',
			'Noted.',
		])
		expect(withoutQuestions('Here it is. Ready?')).toBe('Here it is.')
	})

	it('lets the first question out while the reply is still streaming', () => {
		expect(streamingShown('Good. Where did you log it', false)).toEqual({
			text: 'Good. Where did you log it',
			complete: false,
		})
		expect(streamingShown('Good. Where did you log it, and who checked it? Take', false)).toEqual({
			text: 'Good. Where did you log it?',
			complete: true,
		})
		expect(streamingShown('Noted. And who checked your fix? Here it', true)).toEqual({
			text: 'Noted. Here it',
			complete: false,
		})
	})

	it('drops a sentence that only announces a tool call', () => {
		expect(withoutNarration("Good, you went straight to the deadline. I'll confirm that one.")).toBe(
			'Good, you went straight to the deadline.'
		)
		expect(withoutNarration('Right. I\u2019ll tick that off.')).toBe('Right.')
		expect(withoutNarration('I will mark the assembly point idea done. What next?')).toBe(
			'What next?'
		)
		const mentions = 'So you can confirm you are reading the current one.'
		expect(withoutNarration(mentions)).toBe(mentions)
		expect(shownTurn(["Spot on. I'll confirm that idea now."])).toEqual(['Spot on.'])
		const teaching =
			'Let me mark the steps you got right before we look at the order of the rest.'
		expect(withoutNarration(teaching)).toBe(teaching)
		expect(withoutNarration('Let me confirm, is it Friday?')).toBe('Let me confirm, is it Friday?')
	})
})
