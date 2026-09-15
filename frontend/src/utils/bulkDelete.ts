import { call, toast } from 'frappe-ui'
import { computed, nextTick, ref } from 'vue'

export interface DeleteError {
	messages?: string[]
	message?: string
}

export interface BulkDeleteResult {
	deleted: number
	failed: string[]
	firstError?: DeleteError
}

// Frappe puts the readable half of a server error in `messages`; `message` carries
// a network or client failure.
export function deleteErrorMessage(error: DeleteError | undefined): string {
	return error?.messages?.[0] || error?.message || String(error)
}

// One request per row, all in flight together, so the caller refetches once; a
// list resource's own `delete` refetches inside every success. Settled, not
// all: one rejection would take the reload.
export async function bulkDeleteDocs(
	doctype: string,
	selections: Set<string>
): Promise<BulkDeleteResult> {
	const names = Array.from(selections)
	if (!names.length) return { deleted: 0, failed: [] }

	const results = await Promise.allSettled(
		names.map((name) => call('frappe.client.delete', { doctype, name }))
	)

	const failed: string[] = []
	let firstError: DeleteError | undefined
	results.forEach((result, index) => {
		const name = names[index]
		if (name === undefined) return
		if (result.status === 'rejected') {
			failed.push(name)
			firstError = firstError ?? (result.reason as DeleteError)
			console.error(`Error deleting ${doctype}:`, result.reason)
			return
		}
		selections.delete(name)
	})

	return { deleted: names.length - failed.length, failed, firstError }
}

export interface BulkDeleteOutcome {
	deleted: number
	failed: number
	total: number
	error: string
}

export interface BulkDeleteActionOptions {
	// Called once per run, only when something actually went, so a page refetches
	// whatever it owns: the list, and any count resource fetched beside it.
	onDeleted?: () => void
	// A getter, not a string: `__()` resolves against translations that are not
	// necessarily loaded when a page's setup runs.
	announcement?: () => string
	success: (deleted: number) => string
	// Omit to report every failure through `partial`, whether or not anything
	// survived.
	allFailed?: (outcome: BulkDeleteOutcome) => string
	partial: (outcome: BulkDeleteOutcome) => string
}

// The delete banner action three list pages share: one run at a time, a refetch
// once the requests settle, and a toast separating a clean run from a partial
// one.
export function useBulkDeleteAction(
	doctype: string,
	options: BulkDeleteActionOptions
) {
	// Not the native `disabled` attribute: that blurs the element it is set on,
	// and the banner is where the keyboard already is.
	const deleting = ref(false)

	// The trigger renders as its icon alone and frappe-ui reads `label` into
	// `aria-label`, so the in-flight state reaches everyone else through here. A
	// changed `aria-label` is not reliably re-read.
	const announcement = computed(() =>
		deleting.value && options.announcement ? options.announcement() : ''
	)

	async function run(
		selections: Set<string>,
		unselectAll?: () => void
	): Promise<void> {
		// A run holds the banner up for its whole duration, so a second tap is
		// easy to make. It would resubmit names that have already gone, every one
		// 404s, and the run then reports failure for deletes that worked.
		if (deleting.value) return

		const total = selections.size
		if (!total) return

		deleting.value = true
		let result: BulkDeleteResult
		try {
			result = await bulkDeleteDocs(doctype, selections)
		} finally {
			deleting.value = false
		}

		const { deleted, failed, firstError } = result
		if (deleted) options.onDeleted?.()

		// Pruning the selection writes the list's own `role="status"`. Two polite
		// regions mutated in one flush is a dropped or doubled announcement, and the
		// toast lands on a tick of its own.
		if (options.announcement) await nextTick()

		if (!failed.length) {
			unselectAll?.()
			toast.success(options.success(deleted))
			return
		}

		const outcome: BulkDeleteOutcome = {
			deleted,
			failed: failed.length,
			total,
			error: deleteErrorMessage(firstError),
		}

		// Errors here ask the moderator to decide what to do next, and there is no
		// way to re-read a toast that has gone; the close button is already on.
		const stay = { duration: Infinity }
		if (!deleted && options.allFailed) {
			toast.error(options.allFailed(outcome), stay)
			return
		}

		toast.error(options.partial(outcome), stay)
	}

	return { deleting, announcement, run }
}
