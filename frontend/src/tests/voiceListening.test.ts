import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'

const call = vi.fn(async () => true)
vi.mock('frappe-ui', () => ({ call: (...args: unknown[]) => call(...args) }))

// The engine of each test, so a test can drive its results and errors.
let engines: FakeRecognition[] = []

class FakeRecognition {
	lang = ''
	interimResults = false
	continuous = false
	onresult: ((event: unknown) => void) | null = null
	onend: (() => void) | null = null
	onerror: ((event: { error: string }) => void) | null = null
	start = vi.fn()
	stop = vi.fn()
	abort = vi.fn()
	constructor() {
		engines.push(this)
	}
}

const getUserMedia = vi.fn(() => new Promise(() => {}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// The module keeps per page state, so each test loads it fresh, inside a scope that
// stands in for the component that owns it.
const load = async () => {
	const { useVoice } = await import('@/composables/useVoice')
	let voice!: ReturnType<typeof useVoice>
	const app = createApp(
		defineComponent({
			setup() {
				voice = useVoice()
				return () => null
			},
		}),
	)
	app.mount(document.createElement('div'))
	return voice
}

beforeEach(() => {
	vi.resetModules()
	engines = []
	call.mockClear()
	getUserMedia.mockClear()
	Object.defineProperty(navigator, 'mediaDevices', {
		value: { getUserMedia },
		configurable: true,
	})
	;(window as any).speechSynthesis = { cancel: vi.fn(), getVoices: () => [] }
})

afterEach(() => {
	delete (window as any).webkitSpeechRecognition
})

describe('listening', () => {
	it("uses the browser's engine when it has one, without asking the server", async () => {
		;(window as any).webkitSpeechRecognition = FakeRecognition
		const voice = await load()
		voice.listen(() => {})
		await flush()
		expect(engines).toHaveLength(1)
		expect(engines[0].start).toHaveBeenCalled()
		expect(getUserMedia).not.toHaveBeenCalled()
	})

	it('records for the server when the browser has no engine', async () => {
		const voice = await load()
		voice.listen(() => {})
		await flush()
		expect(call).toHaveBeenCalledWith('lms.lms.ai.api.transcription_available')
		expect(getUserMedia).toHaveBeenCalled()
	})

	it('moves the same turn to the server when the engine fails', async () => {
		;(window as any).webkitSpeechRecognition = FakeRecognition
		const voice = await load()
		voice.listen(() => {})
		await flush()
		engines[0].onerror?.({ error: 'network' })
		await flush()
		expect(getUserMedia).toHaveBeenCalledTimes(1)
		expect(voice.error.value).toBeNull()
		expect(voice.blocked.value).toBe(false)
	})

	it('asks for the microphone, not the server, when access is denied', async () => {
		;(window as any).webkitSpeechRecognition = FakeRecognition
		const voice = await load()
		voice.listen(() => {})
		await flush()
		engines[0].onerror?.({ error: 'not-allowed' })
		await flush()
		expect(getUserMedia).not.toHaveBeenCalled()
		expect(voice.blocked.value).toBe(true)
	})
})
