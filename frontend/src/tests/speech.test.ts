import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({
	call: vi.fn(async () => []),
}))

import { speechText, splitSentences, useSpeech } from '@/composables/useSpeech'

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
		).toBe('The policy covers everyone , always.')
	})
})

describe('splitSentences', () => {
	it('splits on sentence ends so captions can track the voice', () => {
		expect(splitSentences('Hi there! Ready to start? Let us go.')).toEqual([
			'Hi there!',
			'Ready to start?',
			'Let us go.',
		])
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
