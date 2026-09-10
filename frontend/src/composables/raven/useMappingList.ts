// Shared list behaviour for the workspace and channel mapping tables, whose
// endpoints differ only by entity name.
import { createResource, toast } from 'frappe-ui'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { RULE_COMBINATORS } from '@/utils/raven/constants'
import type {
	RavenChannel,
	RavenWorkspace,
	RuleCombinator,
	RuleDiff,
} from '@/types'

export type MappingEntity = 'workspace' | 'channel'
export type MappingRecord = RavenWorkspace | RavenChannel

export interface DropdownOption {
	label: string
	/** Lucide icon CSS class, e.g. `lucide-trash-2`. */
	icon?: string
	theme?: 'red'
	onClick: () => void
}

export interface MappingColumn {
	label: string
	key: string
	width: number | string
}

/**
 * Normalised row. Status is `paused` because ListRow reserves `row.disabled`; `key`
 * is the Raven id, which survives a row flipping unmapped → mapped, so selection does.
 */
export interface MappingRow {
	/** Mapping docname; null until the row is adopted. */
	name: string | null
	/** Stable list/selection key: the Raven id (or `name` as a stale fallback). */
	key: string
	/** False for a raw Raven record not yet adopted into a mapping. */
	mapped: boolean
	/** The Raven workspace/channel id this row points at: the adopt target. */
	ravenId: string
	label: string
	type: string
	rule_combinator: RuleCombinator | null
	paused: boolean
	/** The Raven record behind this mapping is gone, so nothing syncs until it is recreated. */
	stale: boolean
	record: MappingRecord
}

export interface MappingList {
	loading: ComputedRef<boolean>
	rows: ComputedRef<MappingRow[]>
	columns: MappingColumn[]
	/** True for workspaces (adopt on any edit), false for channels (adopt only via Link). */
	adoptOnEdit: boolean
	selectedKey: Ref<string | null>
	selectedRow: ComputedRef<MappingRow | null>
	selectRow: (row: MappingRow) => void
	create: () => void
	/**
	 * Docname for a row, adopting it first if unmapped and flipping it in place.
	 * Recovers from a `DuplicateEntryError` race by re-reading.
	 */
	ensureMapped: (row: MappingRow) => Promise<string>
	/** Channel Link button: adopt the row then reload it as a normal managed row. */
	linkRow: (row: MappingRow) => Promise<void>
	/** Row key whose Link/adopt request is in flight (disables its Link button). */
	linkingKey: Ref<string | null>
	editingLabel: Ref<string | null>
	labelDraft: Ref<string>
	startEdit: (row: MappingRow) => void
	cancelEdit: () => void
	saveLabel: (row: MappingRow) => void
	toggleEnabled: (row: MappingRow, enabled: boolean) => void
	typeMenu: (row: MappingRow) => DropdownOption[]
	combinatorMenu: (row: MappingRow) => DropdownOption[]
	/** The two choices offered on a stale row: recreate the Raven record, or drop our mapping. */
	takeActionMenu: (row: MappingRow) => DropdownOption[]
	deleteOpen: Ref<boolean>
	toDelete: Ref<MappingRow | null>
	deleting: ComputedRef<boolean>
	askDelete: (row: MappingRow) => void
	confirmDelete: () => void
	/** Gate for a combinator switch that moves anyone. Bind to a confirm dialog. */
	combinatorConfirmOpen: Ref<boolean>
	combinatorDiff: Ref<RuleDiff | null>
	pendingCombinatorLabel: ComputedRef<string>
	confirmCombinator: () => void
	cancelCombinator: () => void
}

export interface MappingListOptions {
	entity: MappingEntity
	/** Parent workspace. Required for `entity: 'channel'`, ignored otherwise. */
	workspace?: string
}

const WORKSPACE_TYPES: readonly string[] = ['Public', 'Private']
const CHANNEL_TYPES: readonly string[] = ['Public', 'Private', 'Open']

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
		rule_combinator: record.rule_combinator,
		paused: !record.enabled,
		stale: !!record.stale,
		record,
	}
}

export function useMappingList(options: MappingListOptions): MappingList {
	const entity = options.entity
	const isWorkspace = entity === 'workspace'
	const targetDoctype = isWorkspace
		? 'Raven Workspace Mapping'
		: 'Raven Channel Mapping'
	// Workspaces adopt on any edit; channels adopt only through their Link button.
	const adoptOnEdit = isWorkspace

	// Kept as whole strings (not built with .format) so translators see the
	// finished sentence.
	const copy = isWorkspace
		? {
				create: __('Could not create workspace'),
				rename: __('Could not rename workspace'),
				update: __('Could not update workspace'),
				remove: __('Error deleting workspace mapping'),
				removed: __('Workspace mapping deleted'),
				link: __('Could not link workspace'),
				typeColumn: __('Visibility'),
				recreate: __('Recreate workspace'),
				recreated: __('Raven workspace recreated'),
				recreateFailed: __('Could not recreate the Raven workspace'),
		  }
		: {
				create: __('Could not create channel'),
				rename: __('Could not rename channel'),
				update: __('Could not update channel'),
				remove: __('Error deleting channel mapping'),
				removed: __('Channel mapping deleted'),
				link: __('Could not link channel'),
				typeColumn: __('Type'),
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

	// Selection is by stable key (the Raven id), not the mapping docname, so it
	// survives a row being adopted (name flips null -> docname mid-edit).
	const selectedKey = ref<string | null>(null)
	const selectedRow = computed<MappingRow | null>(
		() => rows.value.find((r) => r.key === selectedKey.value) ?? null
	)
	function selectRow(row: MappingRow): void {
		if (selectedKey.value === row.key) return
		selectedKey.value = row.key
	}

	// One-click create: the backend auto-names "Workspace N" / "Channel N"; we
	// reload and select the new row (its label is editable in place via the pencil).
	const createRecord = createResource({
		url: `raven_integration.api.create_${entity}`,
		onError: onError(copy.create),
		async onSuccess(name: string) {
			await records.reload()
			// create_* returns the mapping docname; find that row and select by key.
			selectedKey.value = rows.value.find((r) => r.name === name)?.key ?? null
		},
	})
	function create(): void {
		createRecord.submit(isWorkspace ? {} : { workspace: options.workspace })
	}

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
		// submit() resolves with the endpoint's data (the new docname) and never
		// rejects. A failure is surfaced via linkRecord.error / its onError.
		const name = (await linkRecord.submit(params)) as string | null | undefined
		if (name) {
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

	// One row edits at a time. Keyed by row key, not docname: an unmapped row's
	// name is null, so keying by name would match every unmapped row at once.
	const editingLabel = ref<string | null>(null)
	const labelDraft = ref('')
	function startEdit(row: MappingRow): void {
		editingLabel.value = row.key
		labelDraft.value = row.label
	}
	function cancelEdit(): void {
		editingLabel.value = null
		labelDraft.value = ''
	}
	// Every inline row edit posts to `set_<entity>_<field>` and reloads the list;
	// only the failure message differs.
	const setField = (field: string, fallback: string = copy.update) =>
		createResource({
			url: `raven_integration.api.set_${entity}_${field}`,
			onSuccess() {
				records.reload()
			},
			onError: onError(fallback),
		})

	const setLabel = setField('label', copy.rename)
	function saveLabel(row: MappingRow): void {
		const next = labelDraft.value.trim()
		if (next && next !== row.label)
			runMapped(row, (name) => setLabel.submit({ name, label: next }))
		cancelEdit()
	}

	const setEnabled = setField('enabled')
	function toggleEnabled(row: MappingRow, enabled: boolean): void {
		runMapped(row, (name) => setEnabled.submit({ name, enabled }))
	}

	const setType = setField('type')
	const typeValues = isWorkspace ? WORKSPACE_TYPES : CHANNEL_TYPES
	function typeMenu(row: MappingRow): DropdownOption[] {
		return typeValues.map((type) => ({
			label: __(type),
			icon: type === row.type ? 'lucide-check' : undefined,
			onClick: () => runMapped(row, (name) => setType.submit({ name, type })),
		}))
	}

	// Rule combinator (Any (OR) / All (AND)): a row Dropdown, like the type one,
	// but a switch rewrites the whole membership either way, so it is previewed and
	// confirmed instead of writing straight through.
	const setCombinator = setField('combinator')

	const pendingCombinator = ref<{
		name: string
		label: string
		combinator: RuleCombinator
	} | null>(null)
	const combinatorDiff = ref<RuleDiff | null>(null)
	const combinatorConfirmOpen = ref(false)

	const combinatorDiffResource = createResource<RuleDiff>({
		url: 'raven_integration.api.compute_rule_diff',
		onSuccess(diff: RuleDiff) {
			if (!pendingCombinator.value) return
			// Confirm whenever the switch moves anyone. AND → OR admits people just
			// as OR → AND evicts them. A switch that moves nobody applies silently.
			if (diff.added > 0 || diff.removed > 0) {
				combinatorDiff.value = diff
				combinatorConfirmOpen.value = true
				return
			}
			applyCombinator()
		},
		onError(err: { messages?: string[] }) {
			// Never switch on a preview we could not compute.
			pendingCombinator.value = null
			toast.error(err?.messages?.[0] ?? copy.update)
		},
	})

	function applyCombinator(): void {
		const pending = pendingCombinator.value
		pendingCombinator.value = null
		combinatorConfirmOpen.value = false
		if (pending)
			setCombinator.submit({
				name: pending.name,
				combinator: pending.combinator,
			})
	}

	const pendingCombinatorLabel = computed<string>(() => {
		const label = pendingCombinator.value?.label ?? ''
		return isWorkspace ? label : `#${label}`
	})

	function cancelCombinator(): void {
		pendingCombinator.value = null
		combinatorConfirmOpen.value = false
		records.reload()
	}

	function combinatorMenu(row: MappingRow): DropdownOption[] {
		return RULE_COMBINATORS.map((combinator) => ({
			label: __(combinator),
			icon: combinator === row.rule_combinator ? 'lucide-check' : undefined,
			onClick: () => {
				if (combinator === row.rule_combinator) return
				runMapped(row, (name) => {
					pendingCombinator.value = { name, label: row.label, combinator }
					combinatorDiffResource.submit({
						target_doctype: targetDoctype,
						name,
						combinator,
					})
				})
			},
		}))
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
			if (toDelete.value && selectedKey.value === toDelete.value.key)
				selectedKey.value = null
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

	const columns: MappingColumn[] = [
		{ label: __('Label'), key: 'label', width: 1 },
		{ label: copy.typeColumn, key: 'type', width: '7rem' },
		{ label: __('Combine rules'), key: 'rule_combinator', width: '8.5rem' },
		{ label: __('Enabled'), key: 'enabled', width: '5.5rem' },
		{ label: '', key: 'actions', width: '2.5rem' },
	]

	return {
		loading,
		rows,
		columns,
		adoptOnEdit,
		selectedKey,
		selectedRow,
		selectRow,
		create,
		ensureMapped,
		linkRow,
		linkingKey,
		editingLabel,
		labelDraft,
		startEdit,
		cancelEdit,
		saveLabel,
		toggleEnabled,
		typeMenu,
		combinatorMenu,
		takeActionMenu,
		deleteOpen,
		toDelete,
		deleting,
		askDelete,
		confirmDelete,
		combinatorConfirmOpen,
		combinatorDiff,
		pendingCombinatorLabel,
		confirmCombinator: applyCombinator,
		cancelCombinator,
	}
}
