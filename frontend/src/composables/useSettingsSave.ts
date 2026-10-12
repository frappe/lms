import { ref, type Ref } from 'vue'
import { toast } from 'frappe-ui'

/**
 * The two refs every settings form's Save owns: whether a write is in
 * flight, and the message from the last one that failed. `error` is
 * optional because two forms report a failure only as a toast.
 */
export interface SaveState {
	saving: Ref<boolean>
	error?: Ref<string>
}

export const useSaveState = (): Required<SaveState> => ({
	saving: ref(false),
	error: ref(''),
})

export interface RunSaveOptions<T = unknown> {
	/** Returns the first thing wrong with the form, or '' when it is fine. */
	validate?: () => string
	/** The write itself, and nothing else. */
	run: () => Promise<T>
	/** Toasted the moment the write lands, before {@link after} runs. */
	success?: string
	/**
	 * What happens once the record is saved: going back, refetching the list.
	 * Separate from `run` so the success toast is not held behind an awaited
	 * refetch, the order every form already had.
	 */
	after?: (result: T) => unknown
	/** The message for a rejected write. */
	failure: (err: unknown) => string
	/**
	 * Toast the validation message as well as recording it. Off by default: a
	 * form with an ErrorMessage in its body has already shown it.
	 */
	toastInvalid?: boolean
	/**
	 * Toast the failure message. On by default; a form that reports a rejected
	 * write inline only (Email Accounts, whose message sits under the fields
	 * that caused it) turns it off rather than saying it twice.
	 */
	toastError?: boolean
}

/**
 * The save skeleton every settings form repeats: refuse a second click while
 * one is in flight, validate, flip `saving`, and settle it either way.
 * Deliberately not in here: the dirty check, and any message or consequence in {@link RunSaveOptions}.
 */
export async function runSave<T>(
	state: SaveState,
	options: RunSaveOptions<T>
): Promise<void> {
	if (state.saving.value) return

	const invalid = options.validate?.() ?? ''
	if (state.error) state.error.value = invalid
	if (invalid) {
		if (options.toastInvalid) toast.error(invalid)
		return
	}

	state.saving.value = true
	try {
		const result = await options.run()
		if (options.success) toast.success(options.success)
		try {
			await options.after?.(result)
		} catch (err) {
			// The write landed. A refetch or a close failing after it is not a
			// failed save, and reporting it as one contradicts the toast already
			// on screen.
			console.error(err)
		}
	} catch (err) {
		const message = options.failure(err)
		if (state.error) state.error.value = message
		if (options.toastError !== false) toast.error(message)
	} finally {
		state.saving.value = false
	}
}
