/**
 * One question per turn, the same plain-text rules as lms/lms/ai/one_question.py, so the page
 * shows and speaks a turn's question the moment it is written instead of waiting for the server
 * to check the finished turn. The server still checks it, for its record of what the learner
 * saw; tests in both places use the same examples so the two never disagree.
 */

// A second ask joined to the first inside one question: "..., and what is the reference?"
const JOINED_ASK =
	/,\s*and\s+(what|which|who|whom|whose|where|when|why|how|do|does|did|can|could|would|will|is|are|was|were|have|has|should)\b/i

// The tutor saying what it is about to do with its own tools ("I'll confirm that one.") is noise
// to the learner: the page shows their progress.
const NARRATION =
	/^(?:\w+,\s*(?:and\s+)?)?(?:I['’]?ll|I will|let me|I['’]?m going to|I am going to)\s+(?:now\s+)?(?:confirm|tick|mark)\b/i

// Longer than this, a sentence is teaching something, whatever it starts with.
const NARRATION_WORDS = 8

/** A short statement, never a question, that only says what the tutor is about to tick. */
const narrates = (sentence: string): boolean =>
	NARRATION.test(sentence) &&
	!sentence.endsWith('?') &&
	sentence.split(/\s+/).length <= NARRATION_WORDS

/** The reply without sentences that only announce a tool call, such as "I'll tick that off.". */
export function withoutNarration(text: string): string {
	const sentences = (text || '').match(/[^.!?]+[.!?]*/g) || []
	const kept = sentences
		.map((sentence) => sentence.trim())
		.filter((sentence) => !narrates(sentence))
	return kept.length === sentences.length ? text : kept.join(' ').trim()
}

/** The reply up to the end of its first question, with any second ask joined to it cut off. */
export function oneAsk(text: string): string {
	text = text || ''
	const end = text.indexOf('?')
	if (end < 0) return text
	const start =
		Math.max(
			text.lastIndexOf('.', end),
			text.lastIndexOf('!', end),
			text.lastIndexOf('\n', end)
		) + 1
	let question = text.slice(start, end + 1)
	const joined = JOINED_ASK.exec(question)
	if (!joined && !text.slice(end + 1).includes('?')) return text
	if (joined) question = question.slice(0, joined.index).replace(/[ ,;]+$/, '') + '?'
	return (text.slice(0, start) + question).trim()
}

/** A later reply in a turn that already asked: its questions go. */
export function withoutQuestions(text: string): string {
	const sentences = (text || '').match(/[^.!?]+[.!?]*/g) || []
	return sentences
		.map((sentence) => sentence.trim())
		.filter((sentence) => !sentence.endsWith('?'))
		.join(' ')
		.trim()
}

/** What the learner sees of a turn's replies, in order. */
export function shownTurn(replies: string[]): string[] {
	let asked = false
	return replies.map((reply) => {
		const text = withoutNarration(reply)
		const shown = asked ? withoutQuestions(text) : oneAsk(text)
		asked = asked || shown.includes('?')
		return shown
	})
}

/**
 * What of a reply still streaming in is final. Before the turn has asked, everything up to its
 * first question is (its words after the question wait for the rest of the reply); once the turn
 * has asked, questions are dropped. `complete` says the text ends on a finished question.
 */
export function streamingShown(
	streamed: string,
	turnAsked: boolean
): { text: string; complete: boolean } {
	const text = withoutNarration(streamed)
	if (turnAsked) return { text: withoutQuestions(text), complete: false }
	const end = (text || '').indexOf('?')
	if (end < 0) return { text: text || '', complete: false }
	return { text: oneAsk(text.slice(0, end + 1)), complete: true }
}
