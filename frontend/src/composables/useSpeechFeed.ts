import { speechText } from '@/composables/useSpeech'

/**
 * Decides what the voice says, so every sentence of a turn is said exactly once.
 *
 * A turn reaches the page three ways: as words streaming in, as the saved reply, and as the
 * reply after the server held it to one question. They differ in their keys, their spacing and
 * where they stop, so matching them by position said sentences twice. Here a sentence is known
 * by its own words: once said in this turn, it is never queued again, whichever copy carries it.
 */

export interface FeedReply {
	key: string
	text: string
}

const SENTENCE_END = /(?<=[.!?])\s+/
// The first words of a turn may go before their sentence ends, cut at a pause, so the voice
// starts on a short phrase while the rest is still being written.
const OPENING_PHRASE = /^([^.!?]{20,60}?[,;:])\s/

const sentencesOf = (text: string): string[] =>
	speechText(text)
		.split(SENTENCE_END)
		.map((part) => part.trim())
		.filter(Boolean)

const keyOf = (sentence: string): string =>
	sentence.toLowerCase().replace(/\s+/g, ' ').trim()

export function createSpeechFeed(say: (text: string) => void) {
	let spoken = new Set<string>()
	let earlier = new Set<string>()
	// An opening phrase already said ahead of its sentence.
	let lead = ''
	let paused = false

	const speak = (sentences: string[]) => {
		const fresh: string[] = []
		for (const sentence of sentences) {
			const key = keyOf(sentence)
			if (spoken.has(key)) continue
			spoken.add(key)
			if (lead) {
				// Only the turn's first sentence can carry the phrase said ahead of it.
				const said = sentence.startsWith(lead) ? lead.length : 0
				lead = ''
				const rest = sentence.slice(said).trim()
				if (rest) fresh.push(rest)
				continue
			}
			fresh.push(sentence)
		}
		// One call keeps short neighbours together, which the voice says with fewer gaps.
		if (fresh.length) say(fresh.join(' '))
	}

	return {
		/** A new learner turn: what was said before belongs to earlier turns. */
		newTurn(keys: string[]) {
			earlier = new Set(keys)
			spoken = new Set()
			lead = ''
		},

		/** Replies that are already heard, such as the history of a reopened lesson. */
		heard(keys: string[]) {
			for (const key of keys) earlier.add(key)
		},

		/** Words still streaming in. `cut` means the text stops where a question was held back,
		 * so even its last sentence is complete. */
		streaming(text: string, cut = false) {
			if (paused || !text) return
			const parts = sentencesOf(text)
			const lastComplete = cut || /[.!?]["')\]]*\s+$/.test(text)
			const complete = lastComplete ? parts : parts.slice(0, -1)
			speak(complete)
			if (!complete.length && !spoken.size && !lead) {
				const opening = OPENING_PHRASE.exec(speechText(text))
				if (opening) {
					lead = opening[1]
					say(lead)
				}
			}
		},

		/** The saved replies of the conversation: whatever this turn has not said yet is said. */
		settled(replies: FeedReply[]) {
			if (paused) return
			for (const reply of replies)
				if (!earlier.has(reply.key)) speak(sentencesOf(reply.text))
		},

		/** Whether every sentence of this turn's saved replies has gone to the voice. */
		allSaid(replies: FeedReply[]): boolean {
			if (paused) return true
			return replies.every(
				(reply) =>
					earlier.has(reply.key) ||
					sentencesOf(reply.text).every((sentence) => spoken.has(keyOf(sentence)))
			)
		},

		/** Paused: nothing is said until resume, which then says what is still unsaid. */
		pause() {
			paused = true
			lead = ''
		},
		resume(replies: FeedReply[]) {
			paused = false
			this.settled(replies)
		},
	}
}
