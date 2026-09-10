import {
	computed,
	nextTick,
	onScopeDispose,
	ref,
	type ComputedRef,
	type Ref,
} from 'vue'

/** How long a typing field rests before its edit is written. */
export const TYPING_REST = 2000
/** How long "Saved" holds before the marker goes quiet. */
export const SAVED_FOR = 2000

export type AutosaveStatus =
	| 'idle'
	| 'dirty'
	| 'pending'
	| 'saving'
	| 'saved'
	| 'error'

/**
 * How settled a change is when committed. `now`: a checkbox, radio,
 * dropdown, switch, Link or file, whole at first interaction. `typing`: text,
 * number or code, written after {@link TYPING_REST} of rest.
 */
export type CommitMode = 'now' | 'typing'

export interface Autosave {
	status: ComputedRef<AutosaveStatus>
	isDirty: ComputedRef<boolean>
	/** An edit is waiting out its rest period; nothing has been sent yet. */
	isPending: ComputedRef<boolean>
	isSaving: ComputedRef<boolean>
	isError: ComputedRef<boolean>
	/** Whatever the last failed write threw. Cleared by the next success. */
	error: Ref<unknown>
	lastSavedAt: Ref<Date | null>
	/**
	 * Report that a control's value has settled. A `now` commit is written once
	 * the current tick's watchers have run rather than from inside the handler,
	 * because the resource decides whether it is dirty in a watcher of its own.
	 */
	commit: (mode?: CommitMode) => void
	/** Send a waiting edit now, on teardown or leaving the route. */
	flush: () => void
	/** Drop a waiting edit without sending it. */
	cancel: () => void
	reset: () => void
}

export interface AutosaveOptions {
	/**
	 * Is there anything to write? For a document, frappe-ui's own `isDirty`
	 * compares against the cloned `originalDoc`, so a field changed and changed
	 * back is clean. The resource re-clones on save and replaces both on reload.
	 */
	isDirty: () => boolean
	/**
	 * Performs one write. Resolve on success, reject to surface an error,
	 * which is what a frappe-ui resource's `submit()` already does.
	 */
	write: () => Promise<unknown>
}

/**
 * Autosave, as a state machine over a resource's dirty flag. Shaped after
 * TanStack's mutations (`status` plus derived booleans) so a page renders
 * from that instead of a display string.
 *
 * Two guarantees: a commit arriving mid-write is held and replayed after,
 * never issued alongside (two writes in flight race the same row); and a
 * clean resource is never written, so typing and deleting again queues nothing.
 */
export function useAutosave(options: AutosaveOptions): Autosave {
	const error = ref<unknown>(null)
	const lastSavedAt = ref<Date | null>(null)

	const saving = ref(false)
	const pending = ref(false)
	const justSaved = ref(false)
	const isDirty = computed(() => Boolean(options.isDirty()))
	let queued = false
	let restTimer: ReturnType<typeof setTimeout> | undefined
	let savedTimer: ReturnType<typeof setTimeout> | undefined
	let tickPending = false

	// Neither frappe-ui's debounce nor vueuse's useDebounceFn can be cancelled,
	// so the rest period is a plain timer this owns and can disarm. The
	// immediate path cancels by clearing its flag instead.
	const disarm = () => {
		clearTimeout(restTimer)
		restTimer = undefined
		tickPending = false
		pending.value = false
	}

	const send = () => {
		if (saving.value) {
			queued = true
			return
		}
		if (!isDirty.value) return

		saving.value = true
		justSaved.value = false

		options
			.write()
			.then(() => {
				error.value = null
				lastSavedAt.value = new Date()
				justSaved.value = true
				clearTimeout(savedTimer)
				savedTimer = setTimeout(() => (justSaved.value = false), SAVED_FOR)
			})
			.catch((reason: unknown) => {
				// The resource stays dirty, so the marker keeps reading "Not saved"
				// and the edit is still there to retry. Nothing is rolled back here.
				error.value = reason ?? new Error('Autosave failed')
			})
			.finally(() => {
				saving.value = false
				if (queued) {
					queued = false
					send()
				}
			})
	}

	// A pick commits from the handler that wrote the value, but frappe-ui's
	// isDirty updates from a deep watcher that Vue runs at end of tick.
	// Sending straight from the handler compares against a stale snapshot,
	// finds it clean, and writes nothing, silently.
	//
	// Waiting out the tick also coalesces the pair of handlers one
	// interaction fires into a single write.
	const sendAfterTick = () => {
		if (tickPending) return
		tickPending = true
		void nextTick().then(() => {
			if (!tickPending) return
			tickPending = false
			send()
		})
	}

	const commit = (mode: CommitMode = 'now') => {
		if (mode === 'now') {
			disarm()
			sendAfterTick()
			return
		}
		clearTimeout(restTimer)
		pending.value = true
		restTimer = setTimeout(() => {
			pending.value = false
			restTimer = undefined
			send()
		}, TYPING_REST)
	}

	const flush = () => {
		if (!restTimer) return
		disarm()
		send()
	}

	const reset = () => {
		disarm()
		clearTimeout(savedTimer)
		queued = false
		justSaved.value = false
		error.value = null
	}

	const status = computed<AutosaveStatus>(() => {
		if (saving.value) return 'saving'
		if (error.value) return 'error'
		if (pending.value) return 'pending'
		if (isDirty.value) return 'dirty'
		if (justSaved.value) return 'saved'
		return 'idle'
	})

	onScopeDispose(() => {
		clearTimeout(restTimer)
		clearTimeout(savedTimer)
	})

	return {
		status,
		isDirty,
		isPending: computed(() => pending.value),
		isSaving: computed(() => saving.value),
		isError: computed(() => Boolean(error.value)),
		error,
		lastSavedAt,
		commit,
		flush,
		cancel: disarm,
		reset,
	}
}
