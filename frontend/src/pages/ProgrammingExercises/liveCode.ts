// Exercises on one lesson share a <head>, so the runner script loads once per
// URL. A failed load is forgotten so the next exercise retries.
const loads = new Map<string, Promise<void>>()

const appendScript = (src: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = src
		script.onload = () => resolve()
		script.onerror = () => {
			script.remove()
			reject(new Error(`Could not load ${src}`))
		}
		document.head.appendChild(script)
	})

export function loadLiveCode(src: string): Promise<void> {
	const pending = loads.get(src)
	if (pending) return pending
	const load = appendScript(src).catch((failure: unknown) => {
		loads.delete(src)
		throw failure
	})
	loads.set(src, load)
	return load
}

type LiveCodeMessage = {
	msgtype: string
	file?: string
	data?: string
}

// Defined by the runner script loadLiveCode() appends.
declare const LiveCodeSession: new (options: {
	base_url: string
	runtime: string
	code: string
	files: { filename: string; contents: string }[]
	onMessage: (msg: LiveCodeMessage) => void
}) => unknown

const RUN_TIMEOUT_MS = 20000

// Runs `code` once against `stdin` and resolves with its trimmed stdout.
export function runLiveCode(options: {
	baseUrl: string
	runtime: string
	code: string
	stdin: string
	onStderr: (text: string) => void
}): Promise<string> {
	return new Promise((resolve, reject) => {
		const stdout: string[] = []
		let exited = false
		new LiveCodeSession({
			base_url: options.baseUrl,
			runtime: options.runtime,
			code: options.code,
			files: [{ filename: 'stdin', contents: options.stdin }],
			onMessage: (msg) => {
				if (msg.msgtype === 'write' && msg.file === 'stdout')
					stdout.push(msg.data ?? '')
				if (msg.msgtype === 'write' && msg.file === 'stderr')
					options.onStderr(msg.data ?? '')
				if (msg.msgtype !== 'exitstatus') return
				exited = true
				resolve(stdout.join('').trim())
			},
		})
		setTimeout(() => {
			if (exited) return
			reject(
				new Error(
					__(
						'The code runner did not answer within 20 seconds. It may be unreachable.'
					)
				)
			)
		}, RUN_TIMEOUT_MS)
	})
}
