// Guards a run waiting out the full 20s timeout after the runner dropped it.
// Came with the runner script ignoring a closed socket (seen when Falcon's
// containers could not start). Added on fix-1 with the close listener.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runLiveCode } from '@/pages/ProgrammingExercises/liveCode'

type Message = { msgtype: string; file?: string; data?: string }

// Stands in for the runner script's LiveCodeSession: hands the test the
// session's onMessage and a socket it can close.
const stubSession = () => {
	const socket = new EventTarget()
	let onMessage: (msg: Message) => void = () => {}
	Object.assign(globalThis, {
		LiveCodeSession: vi.fn(function (
			this: unknown,
			options: { onMessage: typeof onMessage }
		) {
			onMessage = options.onMessage
			return { ws: socket }
		}),
	})
	return {
		send: (msg: Message) => onMessage(msg),
		close: () => socket.dispatchEvent(new Event('close')),
	}
}

const run = () =>
	runLiveCode({
		baseUrl: 'https://runner.example',
		runtime: 'python',
		code: 'print(1)',
		stdin: '',
		onStderr: () => {},
	})

// Only the stand-in goes: unstubAllGlobals would also take setup.ts's `__`.
afterEach(() => {
	delete (globalThis as { LiveCodeSession?: unknown }).LiveCodeSession
	vi.useRealTimers()
})

describe('runLiveCode', () => {
	it('fails at once when the runner closes the connection mid-run', async () => {
		vi.useFakeTimers()
		const session = stubSession()
		const result = run()

		session.close()

		await expect(result).rejects.toThrow('closed the connection')
	})

	it('resolves with stdout when the run exits, even if the socket closes after', async () => {
		const session = stubSession()
		const result = run()

		session.send({ msgtype: 'write', file: 'stdout', data: '1\n' })
		session.send({ msgtype: 'exitstatus' })
		session.close()

		await expect(result).resolves.toBe('1')
	})
})
