// Shared list behaviour for the workspace and channel mapping tables, whose
// endpoints differ only by entity name.
import { createResource, toast } from 'frappe-ui'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { RavenChannel, RavenWorkspace } from '@/types'

export type MappingEntity = 'workspace' | 'channel'
export type MappingRecord = RavenWorkspace | RavenChannel

export interface DropdownOption {
	label: string
	/** Lucide icon CSS class, e.g. `lucide-trash-2`. */
	icon?: string
	theme?: 'red'
	onClick: () => void
}

/** Normalised row. Status is `paused` because ListRow reserves `row.disabled`. */
export interface MappingRow {
	/** Mapping docname; null until the row is adopted. */
	name: string | null
	/** Stable list key: the Raven id, which survives adoption (or `name` when it is cleared). */
	key: string
	/** False for a raw Raven record not yet adopted into a mapping. */
	mapped: boolean
	/** The Raven workspace/channel id this row points at: the adopt target. */
	ravenId: string
	label: string
	type: string
	/**
	 * Switched off, so nothing syncs. Only a channel can be: a workspace mapping
	 * carries no `enabled`, and a workspace row is therefore never paused.
	 */
	paused: boolean
	/** The Raven record behind this mapping is gone, so nothing syncs until it is recreated. */
	stale: boolean
	/** Channel mappings under a workspace. Null on a row that manages nothing yet. */
	channelCount: number | null
	record: MappingRecord
}

export interface MappingList {
	loading: ComputedRef<boolean>
	rows: ComputedRef<MappingRow[]>
	/** Channel Link button: adopt the row then reload it as a normal managed row. */
	linkRow: (row: MappingRow) => Promise<void>
	toggleEnabled: (row: MappingRow, enabled: boolean) => void
	/** The two choices offered on a stale row: recreate the Raven record, or drop our mapping. */
	takeActionMenu: (row: MappingRow) => DropdownOption[]
	deleteOpen: Ref<boolean>
	toDelete: Ref<MappingRow | null>
	deleting: ComputedRef<boolean>
	askDelete: (row: MappingRow) => void
	confirmDelete: () => void
}

export interface MappingListOptions {
	entity: MappingEntity
	/** Parent workspace. Required for `entity: 'channel'`, ignored otherwise. */
	workspace?: string
}

/** The Raven id lives under a different field per entity. */
function ravenIdOf(record: MappingRecord): string {
	return 'workspace_label' in record
		? record.raven_workspace
		: record.raven_channel
}

function toRow(record: MappingRecord): MappingRow {
	const ravenId = ravenIdOf(record)
	// Raven id as key: unchanged across adoption, unlike name (null -> docname).
	// Falls back to the docname for a stale row whose Raven id may be cleared.
	const key = ravenId || record.name || ''
	const [label, type] =
		'workspace_label' in record
			? [record.workspace_label, record.workspace_type]
			: [record.channel_label, record.channel_type]
	return {
		name: record.name,
		key,
		mapped: !!record.mapped,
		ravenId,
		label,
		type,
		// Read off the record rather than negated blindly: a workspace payload has
		// no `enabled` at all, and `!undefined` would mute every workspace in the
		// list as though the whole integration were switched off.
		paused: 'enabled' in record ? !record.enabled : false,
		stale: !!record.stale,
		channelCount:
			'channel_count' in record ? record.channel_count ?? null : null,
		record,
	}
}

export function useMappingList(options: MappingListOptions): MappingList {
	const entity = options.entity
	const isWorkspace = entity === 'workspace'

	// Kept as whole strings (not built with .format) so translators see the
	// finished sentence.
	const copy = isWorkspace
		? {
				update: __('Could not update workspace'),
				remove: __('Error deleting workspace mapping'),
				removed: __('Workspace mapping deleted'),
				link: __('Could not link workspace'),
				recreate: __('Recreate workspace'),
				recreated: __('Raven workspace recreated'),
				recreateFailed: __('Could not recreate the Raven workspace'),
		  }
		: {
				update: __('Could not update channel'),
				remove: __('Error deleting channel mapping'),
				removed: __('Channel mapping deleted'),
				link: __('Could not link channel'),
				recreate: __('Recreate channel'),
				recreated: __('Raven channel recreated'),
				recreateFailed: __('Could not recreate the Raven channel'),
		  }

	const onError =
		(fallback: string) =>
		(err: { messages?: string[] }): void => {
			toast.error(err?.messages?.[0] ?? fallback)
		}

	const records = createResource<MappingRecord[]>({
		url: `raven_integration.api.list_${entity}s`,
		params: isWorkspace ? undefined : { workspace: options.workspace },
		auto: true,
	})

	const rows = computed<MappingRow[]>(() => (records.data ?? []).map(toRow))
	const loading = computed<boolean>(() => records.loading)

	// An unmapped row is a raw Raven record; its first edit adopts it: create the
	// mapping, flip the row in place, return the docname for the caller's edit.
	function isDuplicate(err: unknown): boolean {
		const e = err as { exc_type?: string; messages?: string[] } | null
		if (!e) return false
		if (e.exc_type === 'DuplicateEntryError') return true
		return (e.messages ?? []).some((m) => /already managed|duplicate/i.test(m))
	}

	const linkRecord = createResource({
		url: `raven_integration.api.link_${entity}`,
		onError(err: { exc_type?: string; messages?: string[] }) {
			// A duplicate is a benign adopt race; ensureMapped recovers silently.
			if (isDuplicate(err)) return
			toast.error(err?.messages?.[0] ?? copy.link)
		},
	})

	function flipMapped(row: MappingRow, name: string): void {
		// Mutate the resource record so `rows` re-derives as mapped without a
		// reload. The rule-adopt path reloads only the detail, not this list.
		const rec = row.record as MappingRecord & { name: string; mapped: boolean }
		rec.name = name
		rec.mapped = true
	}

	function resolveName(ravenId: string): string | null {
		const rec = (records.data ?? []).find(
			(r) => ravenIdOf(r) === ravenId && !!r.name
		)
		return rec?.name ?? null
	}

	async function ensureMapped(row: MappingRow): Promise<string> {
		if (row.mapped && row.name) return row.name
		const params = isWorkspace
			? { raven_workspace: row.ravenId }
			: { workspace: options.workspace, raven_channel: row.ravenId }
		// submit() resolves with the endpoint's data and never rejects, but on a
		// failure that data is the LAST SUCCESSFUL call's: frappe-ui's handleError
		// restores `previousData` onto the resource and `fetch` returns it
		// (resources.js). So a link that fails after any link succeeded resolves
		// with the earlier row's docname, and trusting it flips THIS row to
		// someone else's mapping, which runMapped then writes the label, type and
		// enabled edits to. `error` is the reliable signal; it is nulled per call.
		const name = (await linkRecord.submit(params)) as string | null | undefined
		if (!linkRecord.error && name) {
			flipMapped(row, name)
			return name
		}
		if (isDuplicate(linkRecord.error)) {
			// Another edit adopted this row first; re-read and use the existing one.
			await records.reload()
			const resolved = resolveName(row.ravenId)
			if (resolved) {
				flipMapped(row, resolved)
				return resolved
			}
		}
		throw linkRecord.error ?? new Error('link failed')
	}

	// Run a mutating action against a row's mapping name, adopting first if the
	// row is still unmapped. Errors are already surfaced by linkRecord.onError.
	async function runMapped(
		row: MappingRow,
		apply: (name: string) => void
	): Promise<void> {
		try {
			apply(await ensureMapped(row))
		} catch {
			/* adopt failed; the toast fired in linkRecord.onError */
		}
	}

	// Channel Link button: adopt the row, then reload it as a full managed row.
	// The row key (Raven id) is unchanged, so the selection is preserved.
	const linkingKey = ref<string | null>(null)
	async function linkRow(row: MappingRow): Promise<void> {
		if (linkingKey.value) return
		linkingKey.value = row.key
		try {
			await ensureMapped(row)
			await records.reload()
		} catch {
			/* toast fired in linkRecord.onError */
		} finally {
			linkingKey.value = null
		}
	}

	// Every row edit posts to `set_<entity>_<field>` and reloads the list; only
	// the failure message differs.
	const setField = (field: string, fallback: string = copy.update) =>
		createResource({
			url: `raven_integration.api.set_${entity}_${field}`,
			onSuccess() {
				records.reload()
			},
			onError: onError(fallback),
		})

	// Channels only. `set_workspace_enabled` does not exist, a workspace mapping
	// has no `enabled`, so the resource is built for the channel list alone
	// rather than left pointing at an endpoint the server would 404. Nothing
	// renders a workspace switch to call it, and this is what keeps that true.
	const setEnabled = isWorkspace ? null : setField('enabled')
	function toggleEnabled(row: MappingRow, enabled: boolean): void {
		if (!setEnabled) return
		runMapped(row, (name) => setEnabled.submit({ name, enabled }))
	}

	// Rebuilds the vanished Raven doc from the stored label and clears `stale`. It
	// refuses when a parent is stale, so pass that message through untouched.
	const recreateRecord = createResource({
		url: `raven_integration.api.recreate_${entity}`,
		onSuccess() {
			toast.success(copy.recreated)
			records.reload()
		},
		onError: onError(copy.recreateFailed),
	})
	function recreate(row: MappingRow): void {
		recreateRecord.submit({ name: row.name })
	}

	const deleteOpen = ref(false)
	const toDelete = ref<MappingRow | null>(null)
	const deleteRecord = createResource({
		url: `raven_integration.api.delete_${entity}`,
		onSuccess() {
			deleteOpen.value = false
			// Both tables confirm the delete out loud; the channel table used to
			// succeed silently, which was the drift between the two copies.
			toast.success(copy.removed)
			records.reload()
		},
		onError: onError(copy.remove),
	})
	const deleting = computed<boolean>(() => deleteRecord.loading)
	function askDelete(row: MappingRow): void {
		toDelete.value = row
		deleteOpen.value = true
	}
	function confirmDelete(): void {
		// A second confirm while the first is in flight (double-click) must no-op,
		// not race the first for the same row's delete lock. Mirrors linkRow.
		if (deleteRecord.loading) return
		if (toDelete.value?.name) deleteRecord.submit({ name: toDelete.value.name })
	}

	// Stale rows swap their inline controls for this menu: the only two ways out
	// of the state.
	function takeActionMenu(row: MappingRow): DropdownOption[] {
		return [
			{
				label: copy.recreate,
				icon: 'lucide-refresh-cw',
				onClick: () => recreate(row),
			},
			{
				label: __('Delete mapping'),
				icon: 'lucide-trash-2',
				theme: 'red',
				onClick: () => askDelete(row),
			},
		]
	}

	return {
		loading,
		rows,
		linkRow,
		toggleEnabled,
		takeActionMenu,
		deleteOpen,
		toDelete,
		deleting,
		askDelete,
		confirmDelete,
	}
}
