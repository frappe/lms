export type LoadErrorKind =
	| 'offline'
	| 'unreachable'
	| 'denied'
	| 'missing'
	| 'busy'
	| 'server'

export type LoadFailure = {
	name?: string
	status?: number
	exc_type?: string
	messages?: string[]
}

type Loadable = {
	data?: unknown
	doc?: unknown
	error?: unknown
	list?: { error?: unknown }
	get?: { error?: unknown }
}

const DENIED = ['PermissionError', 'AuthenticationError', 'SessionExpired']
const MISSING = ['DoesNotExistError', 'PageDoesNotExistError']

// What went wrong decides what the user can do: wait for the network, ask for
// access, or try again. A fetch that never reached the server has no status.
export const loadErrorKind = (
	failure: unknown,
	online: boolean = navigator.onLine
): LoadErrorKind => {
	if (!online) return 'offline'
	const error = (
		failure && typeof failure === 'object' ? failure : {}
	) as LoadFailure
	const status = error.status
	if (!status && error.name === 'TypeError') return 'unreachable'
	if (status === 401 || status === 403 || DENIED.includes(error.exc_type ?? ''))
		return 'denied'
	if (status === 404 || MISSING.includes(error.exc_type ?? '')) return 'missing'
	if (status === 429 || status === 502 || status === 503 || status === 504)
		return 'busy'
	return 'server'
}

// Only these can succeed on a second try.
export const canRetry = (kind: LoadErrorKind): boolean =>
	kind !== 'denied' && kind !== 'missing'

// A server refusal carries a message; a dropped connection or a crash has none.
export const isRetryableFailure = (error: unknown): boolean =>
	Boolean(error) &&
	!(error as LoadFailure).messages?.length &&
	canRetry(loadErrorKind(error))

// The failure to show in place of the content: once something has loaded, a
// later failure keeps it on screen. Reads a plain, list or document resource.
export const firstLoadError = (
	resource: Loadable | null | undefined
): LoadFailure | null => {
	if (!resource || resource.data || resource.doc) return null
	const error = resource.error ?? resource.list?.error ?? resource.get?.error
	return (error ?? null) as LoadFailure | null
}
