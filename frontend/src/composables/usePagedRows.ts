// Load More for a list whose endpoint answers in one call.
//
// Every other settings panel pages through `useSettingsListResource`, which asks
// the server for one page at a time. The Raven endpoints do not take a page:
// `list_workspaces` merges managed mappings with unmanaged Raven workspaces, and
// `list_workspace_members` assembles each member's channel list by grouping every
// membership row in the workspace, neither can be sliced in SQL without changing
// what it returns. So the fetch stays whole and the *rendering* is what pages.
//
// That makes this a smaller promise than the other lists': it bounds how many
// rows are on screen, not how much came down the wire. Worth having anyway
// these lists share the affordance with the panels either side of them, and a
// workspace with a few hundred members no longer lands as one wall of rows.
import { computed, ref, type ComputedRef } from 'vue'
import { SETTINGS_PAGE_LENGTH } from '@/composables/useSettingsListResource'

export interface PagedRows<T> {
	/** The rows to render: everything revealed so far. */
	visible: ComputedRef<T[]>
	hasNextPage: ComputedRef<boolean>
	loadMore: () => void
	/** Back to the first page. For a filter change, which is a different list. */
	reset: () => void
}

export function usePagedRows<T>(
	rows: () => T[],
	pageSize: number = SETTINGS_PAGE_LENGTH
): PagedRows<T> {
	const shown = ref(pageSize)

	// Deliberately not reset when the underlying data changes: these lists reload
	// after every inline edit, and collapsing back to the first page would take
	// the row the user just toggled off the screen they toggled it on.
	return {
		visible: computed(() => rows().slice(0, shown.value)),
		hasNextPage: computed(() => rows().length > shown.value),
		loadMore: () => {
			shown.value += pageSize
		},
		reset: () => {
			shown.value = pageSize
		},
	}
}
