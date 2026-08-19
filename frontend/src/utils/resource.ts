import { toast } from 'frappe-ui'

/**
 * Submitting a frappe-ui resource without leaking an unhandled rejection.
 *
 * createResource's handleError calls onError and then RETHROWS (resources.js),
 * and frappe-ui's Dialog awaits `action.onClick(ctx)` inside a try/finally with
 * no catch. So `resource.submit(...)` written as a bare statement leaves a
 * rejected promise nobody handles, and every validation failure or 500 prints an
 * uncaught error in the user's console.
 *
 * Swallowing the rejection wholesale is not the fix. frappe-ui runs the success
 * callbacks inside the same `try` that feeds onError, so a bug thrown from the
 * caller's own onSuccess — after the record was already saved — would be
 * reported to the user as a failed request and then silently discarded.
 *
 * This helper separates the two:
 *
 * - A failed request has already been shown to the user by onError, so its
 *   rejection is swallowed.
 * - A throw from onSuccess never reaches frappe-ui's error path at all, so the
 *   user is not told a successful save failed, and it is rethrown here so it
 *   still surfaces as a bug.
 *
 * Validation runs here rather than through createResource's `validate` option,
 * which wraps the message in `new Error(...)`. Reading `.message` back off that
 * is indistinguishable from reading it off a `TypeError: Failed to fetch`, which
 * is how raw browser text ends up in a toast.
 */

/**
 * A user-facing message for whatever onError was handed.
 *
 * Validation arrives as the string itself. A resource failure carries
 * `messages`. Anything else — a network drop, a bug — has no message fit to
 * show, so `.message` is deliberately NOT read: for a failed fetch that is raw
 * browser text like "Failed to fetch".
 */
// frappeRequest guarantees `messages` is non-empty, filling in this exact
// literal when the server sent no _server_messages (frappeRequest.ts). It is
// untranslated English and says nothing useful, so it counts as "no message"
// and the caller's translated fallback wins.
const NO_SERVER_MESSAGE = 'Internal Server Error'

export const resourceErrorMessage = (
	error: unknown,
	fallback: string = __('Something went wrong. Please try again.')
): string => {
	if (typeof error === 'string') return error
	if (typeof error === 'object' && error !== null) {
		const { messages } = error as { messages?: unknown }
		if (
			Array.isArray(messages) &&
			typeof messages[0] === 'string' &&
			messages[0] !== NO_SERVER_MESSAGE
		) {
			return messages[0]
		}
	}
	return fallback
}

export interface SubmitHandlers<T> {
	/** Return a user-facing message to block the submit; undefined to proceed. */
	validate?: () => string | undefined
	/** May be async — a chained submit is awaited before this call settles. */
	onSuccess?: (data: T) => void | Promise<void>
	/** Receives the validation string, or the resource's error object. */
	onError?: (error: unknown) => void
}

interface SubmittableResource<T> {
	submit: (params: unknown, options: Record<string, unknown>) => Promise<T>
}

export async function submitResource<T>(
	resource: SubmittableResource<T>,
	params: unknown = {},
	handlers: SubmitHandlers<T> = {}
): Promise<void> {
	const invalid = handlers.validate?.()
	if (invalid) {
		handlers.onError?.(invalid)
		return
	}

	let successError: unknown = null
	let settled: Promise<void> | undefined
	let reported = false

	try {
		await resource.submit(params, {
			onSuccess(data: T) {
				// frappe-ui calls this synchronously and ignores what it returns, so
				// an async handler (one chaining a second submit) has to be tracked
				// and awaited below rather than left running loose. The try/catch is
				// for a SYNCHRONOUS throw, which happens before Promise.resolve is
				// ever reached and would otherwise escape into frappe-ui's onError.
				try {
					settled = Promise.resolve(handlers.onSuccess?.(data)).then(
						() => undefined,
						(error: unknown) => {
							successError = error
						}
					)
				} catch (error) {
					successError = error
				}
			},
			onError(error: unknown) {
				reported = true
				// Without a caller handler nobody would tell the user: this helper
				// swallows the rejection below, and installing our own onError
				// suppresses frappe-ui's global fallback handler.
				if (handlers.onError) handlers.onError(error)
				else toast.error(resourceErrorMessage(error))
			},
		})
	} catch (error) {
		// Anything onError did not report is not a failure we have shown anyone.
		if (!reported) throw error
	}

	await settled
	if (successError) throw successError
}
