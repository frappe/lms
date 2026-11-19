import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({
	call: vi.fn(async () => []),
}))

import {
	pronounce,
	speechText,
	splitSentences,
	useSpeech,
} from '@/composables/useSpeech'

class FakeUtterance {
	text: string
	voice: unknown = null
	lang = ''
	pitch = 1
	rate = 1
	onend: (() => void) | null = null
	onerror: (() => void) | null = null
	constructor(text: string) {
		this.text = text
	}
}

const spoken: string[] = []

beforeEach(() => {
	spoken.length = 0
	Object.assign(window, {
		SpeechSynthesisUtterance: FakeUtterance,
		speechSynthesis: {
			getVoices: () => [],
			cancel: vi.fn(),
			speak: (utterance: FakeUtterance) => {
				spoken.push(utterance.text)
				// The voice finishes asynchronously, like the real engine.
				setTimeout(() => utterance.onend?.(), 0)
			},
		},
	})
})

describe('speechText', () => {
	it('drops citations and markdown, which are for the eye', () => {
		expect(
			speechText('The policy covers **everyone** [Policy · p.3], _always_.'),
		).toBe('The policy covers everyone, always.')
	})

	it('drops a citation without a page too, but keeps a link', () => {
		expect(speechText('Auditors never audit their own work. [Frappe QMS Manual V 2.1]')).toBe(
			'Auditors never audit their own work.'
		)
		expect(speechText('See [the manual](https://example.com).')).toContain(
			'the manual'
		)
	})
})

describe('splitSentences', () => {
	it('splits on sentence ends so captions can track the voice', () => {
		const long = 'A'.repeat(100) + '.'
		expect(splitSentences(`${long} ${long} Let us go.`)).toEqual([
			long,
			`${long} Let us go.`,
		])
		// The first sentence is always on its own, so the voice starts quickly.
		expect(splitSentences('Good. That is right. Now the next one.')).toEqual([
			'Good.',
			'That is right. Now the next one.',
		])
	})

	it('cuts a long opening sentence at its first pause, so the voice starts sooner', () => {
		expect(
			splitSentences(
				'That is exactly the habit that matters, because a fix that skips the root cause comes back. Next one.',
			),
		).toEqual([
			'That is exactly the habit that matters,',
			'because a fix that skips the root cause comes back. Next one.',
		])
		// A pause too early, or none at all, leaves the sentence whole.
		const plain =
			'Choosing the root cause before changing anything keeps the fix from coming back.'
		expect(splitSentences(plain)).toEqual([plain])
	})

	it('lets short sentences after the first travel together', () => {
		expect(splitSentences('Hi there! Ready to start? Let us go.')).toEqual([
			'Hi there!',
			'Ready to start? Let us go.',
		])
	})

	it('spells Frappe the way it is said, for the voice only', () => {
		expect(pronounce('Frappe makes Frappe Learning.')).toBe(
			'Frappay makes Frappay Learning.',
		)
		expect(pronounce('A frappe is a drink.')).toBe('A frappe is a drink.')
	})

	it('returns nothing for an empty reply', () => {
		expect(splitSentences('   ')).toEqual([])
	})
})

describe('useSpeech', () => {
	it('reads every queued reply in order, sentence by sentence', async () => {
		const speech = useSpeech()
		speech.enqueue('First reply. It has two sentences.')
		speech.enqueue('Second reply.')
		await vi.waitFor(() => expect(speech.speaking.value).toBe(false))
		// Short sentences of one reply share a request; replies never merge.
		expect(spoken).toEqual([
			'First reply.',
			'It has two sentences.',
			'Second reply.',
		])
	})

	it('stop() clears the queue and the caption', async () => {
		const speech = useSpeech()
		speech.enqueue('One. Two. Three.')
		speech.stop()
		await new Promise((resolve) => setTimeout(resolve, 10))
		expect(speech.speaking.value).toBe(false)
		expect(speech.caption.value).toBe('')
		expect(spoken.length).toBeLessThan(3)
	})
})
