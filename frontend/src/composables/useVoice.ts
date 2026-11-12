import { onBeforeUnmount, ref } from 'vue'
import { call } from 'frappe-ui'
import type { VoiceProfile } from '@/utils/characters'

type Recognition = {
	lang: string
	interimResults: boolean
	continuous: boolean
	start: () => void
	stop: () => void
	abort: () => void
	onresult:
		| ((event: {
				resultIndex: number
				results: ArrayLike<
					ArrayLike<{ transcript: string }> & { isFinal: boolean }
				>
		  }) => void)
		| null
	onend: (() => void) | null
	onerror: ((event: { error: string }) => void) | null
}

export type VoiceMode = 'type' | 'speak'

const MODE_KEY = 'lms.goals.voice-mode'

/** How this learner likes to talk to Lumi and the cast, remembered in their own browser only. */
export const preferredMode = (): VoiceMode | null => {
	try {
		const value = window.localStorage.getItem(MODE_KEY)
		return value === 'speak' || value === 'type' ? value : null
	} catch {
		return null
	}
}

export const rememberMode = (mode: VoiceMode) => {
	try {
		window.localStorage.setItem(MODE_KEY, mode)
	} catch {
		// private windows can refuse storage; the choice then lasts for this page only
	}
}

let sidecarSTT: boolean | null = null

// The conversation being spoken in, so transcription can expect its words.
let transcribeSession: string | null = null
export const setTranscribeSession = (session: string | null | undefined) => {
	transcribeSession = session || null
}

/** Whether the voice sidecar can transcribe, asked once per page. */
const serverSTT = async (): Promise<boolean> => {
	if (sidecarSTT === null) {
		try {
			sidecarSTT = Boolean(await call('lms.lms.ai.api.transcription_available'))
		} catch {
			sidecarSTT = false
		}
	}
	return sidecarSTT
}

/**
 * Speaking and listening. Listening prefers the site's Whisper sidecar — recorded
 * locally, endpointed by mic level, transcribed server-side — and falls back to the
 * browser's own speech engine. Speaking falls back to the browser's voices.
 */
export function useVoice() {
	const RecognitionClass =
		(window as unknown as { SpeechRecognition?: new () => Recognition })
			.SpeechRecognition ||
		(window as unknown as { webkitSpeechRecognition?: new () => Recognition })
			.webkitSpeechRecognition
	const canListen = Boolean(
		RecognitionClass || navigator.mediaDevices?.getUserMedia,
	)
	const canSpeak = 'speechSynthesis' in window

	const listening = ref(false)
	const speaking = ref(false)
	/** A recorded turn is at the transcriber; the reply comes right after. */
	const transcribing = ref(false)
	const transcript = ref('')
	const error = ref<string | null>(null)
	/** The microphone is denied, so listening again without the user fixing it is futile. */
	const blocked = ref(false)
	let recognition: Recognition | null = null

	// A pause between thoughts this long after real words ends the learner's turn.
	// A pause this long ends the turn: long enough for a breath mid-thought, short enough
	// that the reply does not feel slow.
	const SILENCE_MS = 1400

	let endTurn: ((send: boolean) => void) | null = null

	const listen = (onDone: (text: string) => void) => {
		if (!canListen) return
		stopSpeaking()
		endTurn?.(false)
		transcript.value = ''
		error.value = null
		listening.value = true
		void (async () => {
			if (await serverSTT()) recordTurn(onDone)
			else if (RecognitionClass) engineTurn(onDone)
			else listening.value = false
		})()
	}

	/** One turn through the sidecar: record, watch the level, transcribe on silence. */
	const recordTurn = async (onDone: (text: string) => void) => {
		let stream: MediaStream
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			})
		} catch {
			blocked.value = true
			error.value = __('Allow microphone access in your browser to speak.')
			listening.value = false
			return
		}
		const device = stream.getAudioTracks()[0]?.label || ''
		const context = new AudioContext()
		const analyser = context.createAnalyser()
		analyser.fftSize = 2048
		context.createMediaStreamSource(stream).connect(analyser)
		const samples = new Uint8Array(analyser.fftSize)
		const recorder = new MediaRecorder(stream)
		const chunks: Blob[] = []
		recorder.ondataavailable = (event) =>
			event.data.size && chunks.push(event.data)

		const started = Date.now()
		let lastLoud = 0
		let heardAny = false
		let sendOnStop = true
		let finished = false
		let stopPreview = () => {}
		const finish = (send: boolean) => {
			if (finished) return
			finished = true
			sendOnStop = send
			stopPreview()
			recorder.stop()
		}
		endTurn = finish

		// The level meter is the endpointer: real signal marks the turn as heard, and
		// SILENCE_MS of quiet after it ends the turn. A mic that never moves the meter
		// is a device problem, and saying so beats listening forever.
		const meter = setInterval(() => {
			analyser.getByteTimeDomainData(samples)
			let sum = 0
			for (let i = 0; i < samples.length; i++) {
				const value = (samples[i] - 128) / 128
				sum += value * value
			}
			const level = Math.sqrt(sum / samples.length)
			const now = Date.now()
			if (level > 0.015) {
				lastLoud = now
				if (!heardAny) {
					heardAny = true
					error.value = null
				}
			}
			if (heardAny && now - lastLoud > SILENCE_MS) finish(true)
			else if (!heardAny && now - started > 6000 && !error.value)
				error.value = __(
					"We can't hear you. Check which microphone the browser and system are using.",
				)
			if (now - started > 90000) finish(true)
		}, 120)

		recorder.onstop = async () => {
			clearInterval(meter)
			stream.getTracks().forEach((track) => track.stop())
			void context.close()
			listening.value = false
			endTurn = null
			if (!heardAny || !sendOnStop) return
			transcribing.value = true
			try {
				const form = new FormData()
				form.append(
					'audio',
					new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
					'turn.webm',
				)
				if (transcribeSession) form.append('session', transcribeSession)
				const response = await fetch('/api/method/lms.lms.ai.api.transcribe', {
					method: 'POST',
					headers: {
						'X-Frappe-CSRF-Token':
							(window as unknown as { csrf_token?: string }).csrf_token || '',
					},
					body: form,
					signal: AbortSignal.timeout(60000),
				})
				if (!response.ok) throw new Error(String(response.status))
				const data = await response.json()
				const text = ((data.message || data).text || '').trim()
				transcript.value = text
				if (text) onDone(text)
				else
					// Naming the device turns "it doesn't work" into "it used the wrong mic".
					error.value = __(
						"We couldn't make out any words. The browser recorded from '{0}'. If that's not your mic, pick another in the address bar and try again.",
					).format(device || __('an unknown device'))
			} catch {
				error.value = __(
					'We could not transcribe that. Tap the mic to try again.',
				)
			} finally {
				transcribing.value = false
			}
		}
		recorder.start()
		stopPreview = previewWords()
	}

	/**
	 * Words on screen while the sidecar records, from the browser's own engine. Only for
	 * the eye: the sidecar's text replaces them and is what gets sent.
	 */
	const previewWords = (): (() => void) => {
		if (!RecognitionClass) return () => {}
		let on = true
		let said = ''
		let preview: Recognition | null = null
		const take = () => {
			preview = new RecognitionClass()
			preview.lang = navigator.language || 'en-US'
			preview.interimResults = true
			preview.continuous = true
			let heard = ''
			preview.onresult = (event) => {
				heard = ''
				for (let i = 0; i < event.results.length; i++)
					heard += event.results[i][0].transcript
				transcript.value = [said, heard].filter(Boolean).join(' ')
			}
			// A preview that cannot run just goes quiet; restarting it would loop.
			preview.onerror = (event) => {
				if (event.error !== 'no-speech') on = false
			}
			preview.onend = () => {
				said = [said, heard].filter(Boolean).join(' ')
				if (on) take()
			}
			preview.start()
		}
		try {
			take()
		} catch {
			return () => {}
		}
		return () => {
			on = false
			preview?.abort()
		}
	}

	/** One turn through the browser's own engine, chained across its short takes. */
	const engineTurn = (onDone: (text: string) => void) => {
		if (!RecognitionClass) return
		let turnText = ''
		let lastHeard = 0
		let active = true
		let settleTimer: ReturnType<typeof setTimeout> | null = null

		const commit = (send: boolean) => {
			active = false
			endTurn = null
			if (settleTimer) clearTimeout(settleTimer)
			listening.value = false
			const text = transcript.value.trim()
			if (send && text) onDone(text)
		}
		endTurn = commit

		// One turn spans several short takes: the engine reliably ends a take at each
		// breath (its continuous mode goes quiet on some Chrome builds), so the take is
		// restarted across pauses, and only SILENCE_MS of quiet after real words — or an
		// explicit stop — ends the turn.
		const take = () => {
			recognition = new RecognitionClass()
			recognition.lang = navigator.language || 'en-US'
			recognition.interimResults = true
			recognition.continuous = false
			let heard = ''
			recognition.onresult = (event) => {
				heard = ''
				for (let i = 0; i < event.results.length; i++)
					heard += event.results[i][0].transcript
				transcript.value = [turnText, heard].filter(Boolean).join(' ')
				lastHeard = Date.now()
			}
			recognition.onerror = (event) => {
				// Silence is not an error in a standing conversation; the turn stays open.
				// Anything else must surface and end the turn: swallowing it restarts the
				// take forever, which looks like listening while hearing nothing.
				if (event.error === 'no-speech' || event.error === 'aborted') return
				blocked.value = event.error === 'not-allowed'
				error.value = blocked.value
					? __('Allow microphone access in your browser to speak.')
					: __(
							'Speech recognition failed ({0}). Check your connection and tap the mic to retry.',
						).format(event.error)
				commit(false)
			}
			recognition.onend = () => {
				if (!active) return
				if (heard) turnText = [turnText, heard].filter(Boolean).join(' ')
				if (turnText && Date.now() - lastHeard >= SILENCE_MS)
					return commit(true)
				take()
				// The next take would otherwise wait out the engine's own long no-speech
				// window; this closes the turn on time if the pause holds.
				if (settleTimer) clearTimeout(settleTimer)
				if (turnText)
					settleTimer = setTimeout(
						() => recognition?.stop(),
						Math.max(lastHeard + SILENCE_MS - Date.now(), 50),
					)
			}
			recognition.start()
		}

		take()
	}

	const stopListening = () => {
		recognition?.stop()
		endTurn?.(true)
	}

	const speak = (text: string, profile?: VoiceProfile) => {
		if (!canSpeak || !text) return
		window.speechSynthesis.cancel()
		const utterance = new SpeechSynthesisUtterance(
			text.replace(/\[[^\]]*·[^\]]*\]/g, '').replace(/[*_#`>]/g, ''),
		)
		utterance.lang = navigator.language || 'en-US'
		if (profile) {
			const voice = pickVoice(profile)
			if (voice) {
				utterance.voice = voice
				utterance.lang = voice.lang
			}
			utterance.pitch = profile.pitch
			utterance.rate = profile.rate
		}
		utterance.onend = () => (speaking.value = false)
		speaking.value = true
		window.speechSynthesis.speak(utterance)
	}

	const stopSpeaking = () => {
		if (canSpeak) window.speechSynthesis.cancel()
		speaking.value = false
	}

	onBeforeUnmount(() => {
		endTurn?.(false)
		recognition?.abort()
		stopSpeaking()
	})

	return {
		canListen,
		canSpeak,
		listening,
		transcribing,
		speaking,
		transcript,
		error,
		blocked,
		listen,
		stopListening,
		speak,
		stopSpeaking,
	}
}

// Names of common free voices: Edge's online "Natural" voices, Chrome's Google voices and the
// ones macOS and Windows ship. The browser reports no gender, so it is read from the name.
const FEMALE =
	/aria|jenny|sonia|libby|neerja|ava|samantha|karen|moira|tessa|serena|allison|zoe|susan|veena|fiona|victoria|emma|zira|hazel|female|google us english$/i
const MALE =
	/guy|ryan|prabhat|daniel|alex\b|tom\b|aaron|arthur|oliver|rishi|fred|lee\b|christopher|eric|davis|david|mark|george|male/i

/** The best-sounding English voice of a family, a different one per slot where there are enough. */
export function pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
	const english = window.speechSynthesis
		.getVoices()
		.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
	if (!english.length) return null
	const local = (navigator.language || '').toLowerCase()
	const quality = (voice: SpeechSynthesisVoice) =>
		(/natural|neural/i.test(voice.name) ? 4 : 0) +
		(/premium|enhanced/i.test(voice.name) ? 3 : 0) +
		(/google/i.test(voice.name) ? 2 : 0) +
		(voice.lang.toLowerCase() === local ? 1 : 0)
	const female = (voice: SpeechSynthesisVoice) => FEMALE.test(voice.name)
	const male = (voice: SpeechSynthesisVoice) =>
		!female(voice) && MALE.test(voice.name)
	const family = english
		.filter(profile.family === 'female' ? female : male)
		.sort((a, b) => quality(b) - quality(a))
	const pool = family.length
		? family
		: english.sort((a, b) => quality(b) - quality(a))
	return pool[profile.slot % pool.length]
}

// Chrome loads its voice list late, so ask once early to have it ready by the first reply.
if (typeof window !== 'undefined' && 'speechSynthesis' in window)
	window.speechSynthesis.getVoices()
