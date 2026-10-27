import { guardPlayerSkips } from '@/utils/videoSkipGuard'

// Bunny Stream's embed speaks the player.js postMessage protocol:
// https://bunny.net/docs/playback-control-api and
// https://github.com/embedly/player.js/blob/master/SPEC.rst
const PLAYERJS_CONTEXT = 'player.js'
const PLAYERJS_VERSION = '0.0.11'
const BUNNY_EMBED =
	/^https:\/\/(?:iframe|player)\.mediadelivery\.net\/embed\/[^/]+\/[^/?#]+/
const TRACKED_EVENTS = [
	'ready',
	'timeupdate',
	'play',
	'pause',
	'ended',
	'seeked',
	'error',
]
// player.js reports a failed command as an error too: 2 is an unknown method
// and 5 a call that threw, usually a blocked autoplay. Neither means the video
// cannot play, so neither may trip the lesson's load-failure fallback.
const COMMAND_ERROR_CODES = [2, 5]

interface PlayerJsMessage {
	context?: string
	event?: string
	value?: unknown
}

interface TimeUpdate {
	seconds?: number
	duration?: number
}

interface PlayerJsError {
	code?: number
	msg?: string
}

interface StreamPlayerEvent {
	detail?: { code?: number; message?: string }
}

type StreamPlayerHandler = (event: StreamPlayerEvent) => void

export const isBunnyStreamSource = (src: string): boolean =>
	BUNNY_EMBED.test(src)

const parseMessage = (data: unknown): PlayerJsMessage | null => {
	if (typeof data !== 'string') return null
	try {
		const message: unknown = JSON.parse(data)
		return message && typeof message === 'object'
			? (message as PlayerJsMessage)
			: null
	} catch {
		return null
	}
}

class BunnyStreamPlayer {
	readonly source: string
	readonly embed = {
		seekTo: (seconds: number, _allowSeekAhead?: boolean): void => {
			this.currentTime = seconds
		},
	}
	private readonly iframe: HTMLIFrameElement
	private readonly origin: string
	private readonly handlers = new Map<string, StreamPlayerHandler[]>()
	private time = 0
	private length = 0
	private ready = false

	constructor(iframe: HTMLIFrameElement) {
		this.iframe = iframe
		this.source = iframe.src
		this.origin = new URL(iframe.src).origin
		window.addEventListener('message', this.receive)
		// A frame that loaded before this ran has already sent its one unprompted
		// ready; subscribing to ready makes the player send it again.
		iframe.addEventListener('load', this.subscribe)
		this.subscribe()
	}

	get currentTime(): number {
		return this.time
	}

	set currentTime(seconds: number) {
		this.time = seconds
		this.send('setCurrentTime', seconds)
	}

	get duration(): number {
		return this.length
	}

	on(event: string, handler: StreamPlayerHandler): void {
		this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
	}

	play(): void {
		this.send('play')
	}

	pause(): void {
		this.send('pause')
	}

	private subscribe = (): void => {
		TRACKED_EVENTS.forEach((event) => this.send('addEventListener', event))
	}

	private send(method: string, value?: string | number): void {
		const message = {
			context: PLAYERJS_CONTEXT,
			version: PLAYERJS_VERSION,
			method,
			value,
			listener: value === undefined ? undefined : `lms-${value}`,
		}
		this.iframe.contentWindow?.postMessage(JSON.stringify(message), this.origin)
	}

	private receive = (event: MessageEvent): void => {
		if (!this.iframe.isConnected) {
			window.removeEventListener('message', this.receive)
			return
		}
		if (event.source !== this.iframe.contentWindow) return
		if (event.origin !== this.origin) return
		const message = parseMessage(event.data)
		if (message?.context !== PLAYERJS_CONTEXT || !message.event) return
		this.handle(message.event, message.value)
	}

	private handle(name: string, value: unknown): void {
		if (name === 'ready') {
			if (this.ready) return
			this.ready = true
		}
		if (name === 'timeupdate') this.readTime(value as TimeUpdate)
		if (name === 'error') {
			const error = (value ?? {}) as PlayerJsError
			if (COMMAND_ERROR_CODES.includes(error.code ?? -1)) return
			this.emit(name, { detail: { code: error.code, message: error.msg } })
			return
		}
		this.emit(name, {})
	}

	private readTime({ seconds, duration }: TimeUpdate = {}): void {
		if (Number.isFinite(seconds)) this.time = Number(seconds)
		if (Number.isFinite(duration)) this.length = Number(duration)
	}

	private emit(name: string, event: StreamPlayerEvent): void {
		this.handlers.get(name)?.forEach((handler) => handler(event))
	}
}

const players = new WeakMap<HTMLIFrameElement, BunnyStreamPlayer>()

const wrap = (iframe: HTMLIFrameElement): BunnyStreamPlayer => {
	const existing = players.get(iframe)
	if (existing) return existing
	const player = new BunnyStreamPlayer(iframe)
	guardPlayerSkips(player)
	players.set(iframe, player)
	return player
}

export function enableBunnyPlayers(): BunnyStreamPlayer[] {
	return Array.from(document.querySelectorAll('iframe'))
		.filter((iframe) => isBunnyStreamSource(iframe.src))
		.map(wrap)
}
