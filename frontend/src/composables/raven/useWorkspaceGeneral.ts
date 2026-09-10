// The workspace General form as a value, so the page header can own Save while
// the tab owns the fields. CRM's SettingsPage puts both the "Not Saved" badge and
// the Save button in the header, next to the title, and reads them off one
// resource; ours reads them off this.
import { createResource, toast } from 'frappe-ui'
import { computed, reactive, watch, type ComputedRef } from 'vue'
import type { WorkspaceDetail, WorkspaceVisibility } from '@/types'

export interface WorkspaceGeneralForm {
	draft: { label: string; type: WorkspaceVisibility }
	/** The page stands for a workspace that does not exist yet, so Save creates it
	 *  rather than writing fields of a record. The button is labelled Save either
	 *  way, as CRM's SlaPolicyView labels its own. */
	isNew: ComputedRef<boolean>
	/** Differs from what is stored, so there is something for Save to send. */
	dirty: ComputedRef<boolean>
	/** Enough is filled in for Save to commit, what disables the button. */
	canSubmit: ComputedRef<boolean>
	saving: ComputedRef<boolean>
	/** Nothing here is editable while the Raven workspace is gone. */
	locked: ComputedRef<boolean>
	save: () => Promise<void>
	reset: () => void
}

export function useWorkspaceGeneral(
	detail: ComputedRef<WorkspaceDetail | null>,
	onChanged: () => void,
	options: {
		/** The mapping's docname is derived from its label, so saving a rename moves
		 *  it. The owner has to adopt the new one or every later request on the page
		 *  is addressed to a doc that no longer exists. */
		onRenamed?: (newName: string) => void
		/** True while the page has no record behind it. New is a page, not a write:
		 *  clicking it used to POST create_workspace and leave a live Raven
		 *  workspace behind before anything had been filled in. */
		isNew?: () => boolean
		/** The docname create_workspace answered with. The owner adopts it, which
		 *  turns this page into the ordinary detail page for what was just made. */
		onCreated?: (newName: string) => void
	} = {}
): WorkspaceGeneralForm {
	const isNew = computed<boolean>(() => !!options.isNew?.())

	const draft = reactive<{ label: string; type: WorkspaceVisibility }>({
		label: '',
		type: 'Private',
	})

	/** Which record the draft currently holds. Null until the first load lands. */
	let draftFor: string | null = null

	/** What the draft was last seeded with, so an edit can be told from a record
	 *  that moved underneath one. `dirty` cannot answer that on its own: it reads
	 *  the record as it stands *now*, which by the time a reload has landed is the
	 *  new value, so an untouched draft measures as changed. */
	const seeded = reactive<{ label: string; type: WorkspaceVisibility }>({
		label: '',
		type: 'Private',
	})

	function reset(): void {
		if (!detail.value) return
		draft.label = detail.value.workspace_label
		draft.type = detail.value.workspace_type
		seeded.label = draft.label
		seeded.type = draft.type
		draftFor = detail.value.name
	}

	const edited = computed<boolean>(
		() => draft.label !== seeded.label || draft.type !== seeded.type
	)

	const trimmedLabel = computed<string>(() => draft.label.trim())

	const dirty = computed<boolean>(() => {
		// Nothing is stored yet, so anything filled in is unsaved work. That is what
		// the leave guard asks about, and why a half-filled new record counts.
		if (isNew.value) return !!trimmedLabel.value || draft.type !== 'Private'
		if (!detail.value) return false
		return (
			(!!trimmedLabel.value &&
				trimmedLabel.value !== detail.value.workspace_label) ||
			draft.type !== detail.value.workspace_type
		)
	})

	// A new workspace needs a name and nothing else; a stored one also needs
	// something to send. The auto-named fallback the backend still offers API
	// callers has no UI caller any more, so an empty name never commits.
	const canSubmit = computed<boolean>(() =>
		isNew.value ? !!trimmedLabel.value : dirty.value
	)

	// A reload can come from something that is not a save, the Enabled switch
	// reloads on both success and failure, and so does a rejected rename. Reseeding
	// then would throw away edits the user is in the middle of making, with no
	// toast and no prompt, so a record already on screen keeps its unsaved draft.
	//
	// Keyed on the docname, as useChannelRules keys its own guard: a load for a
	// *different* record always wins, because that is a navigation, not a refresh.
	// The mapping autonames from its label, so a rename made elsewhere moves the
	// docname and lands on that branch rather than being held off by this draft.
	//
	// Two terms rather than that composable's one, because its `dirty` is measured
	// against the last load and this one against the live record. `edited` is the
	// half that says the user typed something; `dirty` is the half that says it has
	// not landed yet, and is what re-seeds the draft after a save of its own
	// where the reload carries exactly what was typed.
	watch(
		detail,
		(current) => {
			if (current && draftFor === current.name && edited.value && dirty.value)
				return
			reset()
		},
		{ immediate: true, deep: true }
	)

	const locked = computed<boolean>(() => !!detail.value?.stale)

	function onError(fallback: string) {
		return (err: { messages?: string[] }): void => {
			toast.error(err?.messages?.[0] ?? fallback)
			onChanged()
		}
	}

	const setLabel = createResource({
		url: 'raven_integration.api.set_workspace_label',
		onError: onError(__('Could not rename the workspace')),
	})

	const setWorkspaceType = createResource({
		url: 'raven_integration.api.set_workspace_type',
		onError: onError(__('Could not change the visibility')),
	})

	// Its own error handler rather than the shared one: there is no record to
	// reload when the create is the thing that failed.
	const createWorkspace = createResource({
		url: 'raven_integration.api.create_workspace',
		onError(err: { messages?: string[] }) {
			toast.error(err?.messages?.[0] ?? __('Could not create the workspace'))
		},
	})

	const saving = computed<boolean>(
		() =>
			setLabel.loading || setWorkspaceType.loading || createWorkspace.loading
	)

	// One call, because there is no record yet for the two field endpoints below to
	// address. Afterwards the owner adopts the docname and the page becomes the
	// ordinary detail page for what was just created: the heading turns into the
	// workspace's name, the Enabled switch appears, and the Channels tab can add
	// a channel under it.
	async function create(): Promise<void> {
		if (!trimmedLabel.value) return
		const created = (await createWorkspace.submit({
			label: trimmedLabel.value,
			type: draft.type,
		})) as string | null | undefined
		if (!created) return
		toast.success(__('Workspace created'))
		options.onCreated?.(created)
	}

	// Two endpoints, one button: each writes its own field, so only the changed
	// ones are sent. Sequenced, rename last: the mapping autonames from its label,
	// so a rename moves the docname, and a visibility write issued in parallel
	// could land after it and address a doc that is gone.
	async function save(): Promise<void> {
		if (isNew.value) return create()
		const current = detail.value
		if (!current || !dirty.value) return
		if (draft.type !== current.workspace_type) {
			await setWorkspaceType.submit({ name: current.name, type: draft.type })
			// submit() does not reject, so without this the rename runs anyway and
			// the page comes back showing the new name with the old visibility. The
			// drafts stay dirty, so Save can be pressed again.
			if (setWorkspaceType.error) return
		}
		if (trimmedLabel.value && trimmedLabel.value !== current.workspace_label) {
			const renamed = (await setLabel.submit({
				name: current.name,
				label: trimmedLabel.value,
			})) as { name?: string } | undefined
			// Gated like the visibility write above: setLabel's own onError has
			// already reloaded, and falling through would issue a second identical
			// request off a resolved value that, on failure, is the last SUCCESSFUL
			// call's data rather than this one's.
			if (setLabel.error) return
			// Hand the new docname up instead of reloading. The reload reads the name
			// off the owner's prop, and reloading under the old one asked the server
			// for a workspace that no longer answers to it. Adopting the new name
			// moves that prop, which reloads the page by itself.
			if (renamed?.name && renamed.name !== current.name && options.onRenamed) {
				options.onRenamed(renamed.name)
				return
			}
		}
		onChanged()
	}

	return { draft, isNew, dirty, canSubmit, saving, locked, save, reset }
}
