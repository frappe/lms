import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { call } from 'frappe-ui'
import { pickVoice } from '@/composables/useVoice'
import { VOICES, type CharacterKey } from '@/utils/characters'

/**
 * Reads replies aloud sentence by sentence, with the sentence being spoken as a live
 * caption. A hosted voice (lms.lms.ai.api.speech) is used when the site has one; the
 * browser's speechSynthesis otherwise. Replies queue, so a burst of messages is read
 * in full and in order — not just the newest one.
 *
 * Audio for the next sentences is fetched while the current one plays, and the caption
 * changes only when its audio actually starts, so the voice and the caption stay
 * together and the gap between sentences is the fetch time left over, usually none.
 */

const PROVIDER_KEY = 'lms.goals.voice-provider'

/** A dev override: 'browser', or a provider name. Learners never choose this. */
export const preferredProvider = (): string | null => {
	try {
		return window.localStorage.getItem(PROVIDER_KEY)
	} catch {
		return null
	}
}

let hostedProviders: string[] | null = null

/** The hosted voices the site offers, asked once per page. */
export async function speechProviders(): Promise<string[]> {
	if (hostedProviders === null) {
		try {
			hostedProviders = (await call('lms.lms.ai.api.speech_providers')) || []
		} catch {
			hostedProviders = []
		}
	}
	return hostedProviders
}

/** Citations and markdown are for the eye; the voice reads plain sentences. */
export const speechText = (text: string): string =>
	(text || '')
		.replace(/\[[^\]]*·[^\]]*\]/g, '')
		.replace(/[*_#`>]/g, '')
		.replace(/\s+/g, ' ')
		.trim()

/** Sentences to speak one at a time, so captions track the voice without timestamps. */
export const splitSentences = (text: string): string[] =>
	speechText(text)
		.split(/(?<=[.!?])\s+/)
		.map((part) => part.trim())
		.filter(Boolean)

const PREFETCH = 2

interface QueueItem {
	sentence: string
	character: CharacterKey
	/** The audio being fetched ahead; null means the browser voice carries it. */
	url?: Promise<string | null>
}

export function useSpeech() {
	const speaking = ref(false)
	const caption = ref('')
	/** Sentences still waiting after the one being spoken. */
	const remaining = ref(0)
	const queue: QueueItem[] = []
	const blobUrls = new Set<string>()
	let generation = 0
	let audio: HTMLAudioElement | null = null

	const enqueue = (text: string, character: CharacterKey = 'lumi') => {
		const sentences = splitSentences(text)
		if (!sentences.length) return
		for (const sentence of sentences) queue.push({ sentence, character })
		remaining.value = queue.length
		if (!speaking.value) void drain(generation)
	}

	const stop = () => {
		generation += 1
		queue.length = 0
		remaining.value = 0
		audio?.pause()
		audio = null
		for (const url of blobUrls) URL.revokeObjectURL(url)
		blobUrls.clear()
		if ('speechSynthesis' in window) window.speechSynthesis.cancel()
		speaking.value = false
		caption.value = ''
	}

	const drain = async (token: number) => {
		speaking.value = true
		try {
			while (queue.length && token === generation) {
				for (const item of queue.slice(0, PREFETCH))
					item.url ||= fetchAudio(item)
				const item = queue.shift()!
				remaining.value = queue.length
				const url = await item.url!
				if (token !== generation) return
				caption.value = item.sentence
				if (url) await playUrl(url, token)
				else await playBrowser(item.sentence, item.character, token)
			}
		} finally {
			if (token === generation) {
				speaking.value = false
				caption.value = ''
			}
		}
	}

	const fetchAudio = async (item: QueueItem): Promise<string | null> => {
		const provider = preferredProvider()
		if (provider === 'browser' || !(await speechProviders()).length) return null
		try {
			const response = await fetch('/api/method/lms.lms.ai.api.speech', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Frappe-CSRF-Token':
						(window as unknown as { csrf_token?: string }).csrf_token || '',
				},
				body: JSON.stringify({
					text: item.sentence,
					character: item.character,
					provider: provider || undefined,
				}),
			})
			if (!response.ok) return null
			const url = URL.createObjectURL(await response.blob())
			blobUrls.add(url)
			return url
		} catch {
			// The provider hiccuped; the browser voice carries this sentence.
			return null
		}
	}

	const playUrl = async (url: string, token: number) => {
		try {
			if (token !== generation) return
			audio = new Audio(url)
			await new Promise<void>((resolve) => {
				audio!.onended = () => resolve()
				audio!.onerror = () => resolve()
				// Autoplay can be refused on a reload with no gesture yet; skip the audio,
				// keep the caption.
				audio!.play().catch(() => resolve())
			})
		} finally {
			URL.revokeObjectURL(url)
			blobUrls.delete(url)
		}
	}

	const playBrowser = (
		sentence: string,
		character: CharacterKey,
		token: number,
	) =>
		new Promise<void>((resolve) => {
			if (!('speechSynthesis' in window) || token !== generation)
				return resolve()
			const utterance = new SpeechSynthesisUtterance(sentence)
			const profile = VOICES[character]
			const voice = pickVoice(profile)
			if (voice) {
				utterance.voice = voice
				utterance.lang = voice.lang
			}
			utterance.pitch = profile.pitch
			utterance.rate = profile.rate
			utterance.onend = () => resolve()
			utterance.onerror = () => resolve()
			window.speechSynthesis.speak(utterance)
		})

	// Tests build this outside a component; there, the caller stops it.
	if (getCurrentInstance()) onBeforeUnmount(stop)

	return { speaking, caption, remaining, enqueue, stop }
}
