import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => ({
	data: { prevent_skipping_videos: 1 } as Record<string, unknown>,
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({ settings }) }))

import {
	enableBunnyPlayers,
	isBunnyStreamSource,
} from '@/utils/bunnyStreamPlayer'

const SRC = 'https://player.mediadelivery.net/embed/123/abc-def'
const ORIGIN = 'https://player.mediadelivery.net'

const mountIframe = (src = SRC): HTMLIFrameElement => {
	const iframe = document.createElement('iframe')
	iframe.src = src
	document.body.appendChild(iframe)
	return iframe
}

const fromPlayer = (
	iframe: HTMLIFrameElement,
	event: string,
	value?: unknown,
	origin = ORIGIN
): void => {
	const data = JSON.stringify({ context: 'player.js', event, value })
	window.dispatchEvent(
		new MessageEvent('message', {
			data,
			origin,
			source: iframe.contentWindow,
		})
	)
}

interface SentMessage {
	context?: string
	method?: string
	value?: unknown
}

const sent = (spy: { mock: { calls: unknown[][] } }): SentMessage[] =>
	spy.mock.calls.map(([message]) => JSON.parse(String(message)))

beforeEach(() => {
	vi.useFakeTimers()
	settings.data = { prevent_skipping_videos: 1 }
})
afterEach(() => {
	vi.useRealTimers()
	document.body.innerHTML = ''
})

describe('isBunnyStreamSource', () => {
	it.each([
		[SRC, true],
		['https://iframe.mediadelivery.net/embed/123/abc-def', true],
		['https://player.mediadelivery.net.evil.com/embed/1/2', false],
		['https://www.youtube.com/embed/abc', false],
		['', false],
	])('%s -> %s', (src, expected) => {
		expect(isBunnyStreamSource(src)).toBe(expected)
	})
})

describe('enableBunnyPlayers', () => {
	it('wraps each Bunny iframe once and ignores other iframes', () => {
		mountIframe()
		mountIframe('https://drive.google.com/file/d/x/preview')
		const first = enableBunnyPlayers()
		const second = enableBunnyPlayers()
		expect(first).toHaveLength(1)
		expect(second[0]).toBe(first[0])
		expect(first[0].source).toBe(SRC)
	})

	it('subscribes over player.js to the events the lesson tracks', () => {
		const iframe = mountIframe()
		const post = vi.spyOn(iframe.contentWindow!, 'postMessage')
		enableBunnyPlayers()
		const subscribed = sent(post)
			.filter((message) => message.method === 'addEventListener')
			.map((message) => message.value)
		expect(subscribed).toEqual(
			expect.arrayContaining(['ready', 'timeupdate', 'ended', 'error'])
		)
		expect(post.mock.calls[0][1]).toBe(ORIGIN)
		expect(sent(post)[0].context).toBe('player.js')
	})
})

describe('BunnyStreamPlayer', () => {
	const setup = () => {
		const iframe = mountIframe()
		const post = vi.spyOn(iframe.contentWindow!, 'postMessage')
		const [player] = enableBunnyPlayers()
		return { iframe, post, player }
	}

	it('reports ready, time, duration and ended from the iframe', () => {
		const { iframe, player } = setup()
		const ready = vi.fn()
		const ended = vi.fn()
		player.on('ready', ready)
		player.on('ended', ended)

		fromPlayer(iframe, 'ready', { src: SRC })
		fromPlayer(iframe, 'ready', { src: SRC })
		fromPlayer(iframe, 'play')
		vi.advanceTimersByTime(10_000)
		fromPlayer(iframe, 'timeupdate', { seconds: 12, duration: 300 })
		fromPlayer(iframe, 'ended')

		expect(ready).toHaveBeenCalledTimes(1)
		expect(ended).toHaveBeenCalledTimes(1)
		expect(player.currentTime).toBe(12)
		expect(player.duration).toBe(300)
	})

	it('ignores messages from another origin or another frame', () => {
		const { iframe, player } = setup()
		const ended = vi.fn()
		player.on('ended', ended)
		fromPlayer(iframe, 'ended', undefined, 'https://evil.example')
		const other = mountIframe('https://player.mediadelivery.net/embed/9/z')
		fromPlayer(other, 'ended')
		expect(ended).not.toHaveBeenCalled()
	})

	it('forwards a playback error but not a failed command', () => {
		const { iframe, player } = setup()
		const error = vi.fn()
		player.on('error', error)
		fromPlayer(iframe, 'error', { code: 5, msg: 'autoplay blocked' })
		fromPlayer(iframe, 'error', { code: 1, msg: 'not supported' })
		expect(error).toHaveBeenCalledTimes(1)
		expect(error).toHaveBeenCalledWith({
			detail: { code: 1, message: 'not supported' },
		})
	})

	it('seeks with setCurrentTime', () => {
		const { post, player } = setup()
		player.embed.seekTo(42, true)
		expect(sent(post).at(-1)).toMatchObject({
			method: 'setCurrentTime',
			value: 42,
		})
	})

	it('snaps a skip past the furthest watched point back', () => {
		const { iframe, post } = setup()
		fromPlayer(iframe, 'play')
		for (let t = 1; t <= 10; t++) {
			vi.advanceTimersByTime(1000)
			fromPlayer(iframe, 'timeupdate', { seconds: t, duration: 300 })
		}
		vi.advanceTimersByTime(250)
		fromPlayer(iframe, 'timeupdate', { seconds: 200, duration: 300 })
		expect(sent(post).at(-1)).toMatchObject({
			method: 'setCurrentTime',
			value: 10,
		})
	})
})
