import { onBeforeUnmount } from 'vue'
import { call } from 'frappe-ui'
import { warmSpeech } from '@/composables/useSpeech'
import type { CharacterKey } from '@/utils/characters'

const POLL_MS = 1000
// The opening takes a few seconds to write; past this the screen stops asking.
const POLLS = 30

interface Prepared {
	opening: string | null
}

/**
 * Has the server open a lesson or role-play while its start screen shows, so the opening is
 * written by the time the learner presses Start. When they will listen, the voice makes the
 * opening's first lines ahead too, and they play the moment the conversation opens.
 */
export function useOpening(
	target: () => { assignment: string; index: number },
	character: () => CharacterKey,
	listens: () => boolean
) {
	let asked: Promise<Prepared | null> | null = null
	let stopped = false

	const ask = () =>
		call('lms.lms.ai.api.prepare_conversation', target()).catch(
			() => null
		) as Promise<Prepared | null>

	const prepare = () => {
		stopped = false
		asked = ask()
		void waitForOpening(asked)
	}

	const waitForOpening = async (first: Promise<Prepared | null>) => {
		let reply = await first
		for (let poll = 0; reply && !reply.opening && poll < POLLS; poll++) {
			await new Promise((resolve) => setTimeout(resolve, POLL_MS))
			if (stopped) return
			reply = await ask()
		}
		if (!stopped && reply?.opening && listens())
			warmSpeech(reply.opening, character())
	}

	/** Called by Start: the session must exist first, or Start would open a second one. */
	const ready = async () => {
		stopped = true
		await asked
	}

	onBeforeUnmount(() => {
		stopped = true
	})
	return { prepare, ready }
}
