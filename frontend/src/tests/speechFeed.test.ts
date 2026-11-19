/**
 * createSpeechFeed: what Lumi's voice says. The sentences are from a real lesson where the old
 * logic read them twice.
 */
import { describe, expect, it } from 'vitest'
import { createSpeechFeed } from '@/composables/useSpeechFeed'

const REPLY =
	'Good, you read that as clearly supporting the policy, and your reasoning about checking the upgrade path fits. ' +
	'The policy says quality is critical to Frappe\'s success [Manual · p.4]. Now let\'s look at your duties.'

function feed() {
	const said: string[] = []
	const voice = createSpeechFeed((text) => said.push(text))
	return { said, voice }
}

/** Every sentence the voice was given, split back out, so a repeat shows as a duplicate. */
const sentences = (said: string[]) =>
	said
		.join(' ')
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean)

describe('createSpeechFeed', () => {
	it('says a streamed reply once, even when the saved copy arrives under another key', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		for (let i = 20; i <= REPLY.length; i += 17) voice.streaming(REPLY.slice(0, i))
		voice.settled([{ key: 'a10', text: REPLY }])
		voice.settled([{ key: 'a10', text: REPLY }])

		expect(sentences(said)).toEqual([
			'Good, you read that as clearly supporting the policy, and your reasoning about checking the upgrade path fits.',
			"The policy says quality is critical to Frappe's success.",
			"Now let's look at your duties.",
		])
	})

	it('starts on the opening phrase and never says that phrase again', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		voice.streaming('Good, you read that as clearly supporting the policy, and your')
		const first = said[0]
		voice.settled([{ key: 'a1', text: REPLY }])

		expect(first).toBe('Good, you read that as clearly supporting the policy,')
		expect(said.join(' ')).not.toMatch(/supporting the policy, .*supporting the policy,/)
		expect(said.join(' ').match(/Good, you read/g)).toHaveLength(1)
	})

	it('says the question once the server has held the turn to it, and nothing twice', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		const streamed = 'Thanks, that is a clear example.'
		voice.streaming(streamed, true)
		voice.settled([
			{
				key: 'a34',
				text: 'Thanks, that is a clear example. Are you ready to try a few quick exercises?',
			},
		])

		expect(sentences(said)).toEqual([
			'Thanks, that is a clear example.',
			'Are you ready to try a few quick exercises?',
		])
	})

	it('waits for the end of a sentence before saying it', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		voice.streaming('Spot on. You caught all three duties')
		expect(sentences(said)).toEqual(['Spot on.'])
		voice.streaming('Spot on. You caught all three duties. ')
		expect(sentences(said)).toEqual(['Spot on.', 'You caught all three duties.'])
	})

	it('leaves replies from earlier turns alone', () => {
		const { said, voice } = feed()
		voice.newTurn(['a3', 'u9'])
		voice.settled([
			{ key: 'a3', text: 'Hello Ashley, I am Lumi.' },
			{ key: 'a10', text: 'Where does quality show up in your work?' },
		])
		expect(said).toEqual(['Where does quality show up in your work?'])
	})

	it('says a sentence again in a new turn, such as when the learner asks to repeat', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		voice.settled([{ key: 'a10', text: 'Where does quality show up?' }])
		voice.newTurn(['a10', 'u16'])
		voice.settled([
			{ key: 'a10', text: 'Where does quality show up?' },
			{ key: 'a17', text: 'Where does quality show up?' },
		])
		expect(said).toEqual(['Where does quality show up?', 'Where does quality show up?'])
	})

	it('stays silent while paused and says what arrived meanwhile on resume', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		voice.pause()
		voice.streaming('Spot on. Now the next one. ')
		voice.settled([{ key: 'a5', text: 'Spot on. Now the next one.' }])
		expect(said).toEqual([])
		expect(voice.allSaid([{ key: 'a5', text: 'Spot on. Now the next one.' }])).toBe(true)

		voice.resume([{ key: 'a5', text: 'Spot on. Now the next one.' }])
		expect(sentences(said)).toEqual(['Spot on.', 'Now the next one.'])
	})

	it('knows when everything of the turn has gone to the voice', () => {
		const { voice } = feed()
		voice.newTurn(['a1'])
		const replies = [
			{ key: 'a1', text: 'Old reply, already heard.' },
			{ key: 'a2', text: 'First. Second.' },
		]
		expect(voice.allSaid(replies)).toBe(false)
		voice.streaming('First. ')
		expect(voice.allSaid(replies)).toBe(false)
		voice.settled(replies)
		expect(voice.allSaid(replies)).toBe(true)
	})

	it('does not read citations or markdown, and matches a sentence however it is spaced', () => {
		const { said, voice } = feed()
		voice.newTurn([])
		voice.streaming('Keep the **NC report** as evidence [Manual · p.43].  ')
		voice.settled([
			{ key: 'a1', text: 'Keep the NC report as evidence [Manual · p.43].' },
		])
		expect(said).toEqual(['Keep the NC report as evidence.'])
	})
})
