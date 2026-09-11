import { computed, reactive, ref, shallowRef, watch, type Ref } from 'vue'
import { call, createDocumentResource } from 'frappe-ui'
import type { SettingsSource } from '@/types/settingsSchema'
import type { SettingsListRow } from '@/types/settingsList'

/** The record id a detail page uses for a row that is not on the server yet. */
export const NEW_RECORD = 'new'

const LMS_SETTINGS = 'LMS Settings'

/**
 * frappe-ui ships `DocumentResource` only as an internal .d.ts and does not
 * export it, so this is a hand-declared slice of what these pages use.
 */
export interface SettingsDocumentResource {
	/**
	 * The name the resource addresses, which every one of its requests is built
	 * from at send time. Writable, and that is what a rename needs it for.
	 */
	name: string
	doc: SettingsListRow | null
	/**
	 * The document as the resource last heard it from the server. It is the
	 * other half of `isDirty`, and the half a rename moves without it noticing.
	 */
	originalDoc?: SettingsListRow | null
	isDirty?: boolean
	get?: { loading: boolean }
	save: {
		submit: (values?: object, options?: object) => Promise<unknown>
		loading?: boolean
	}
	reload: () => Promise<unknown>
}

export interface UseSettingsSourceOptions {
	/**
	 * The record id for a `{ doctype, record: 'route' }` source, from the URL.
	 * {@link NEW_RECORD} yields a draft instead of a document.
	 */
	record?: Ref<string | null>
	/**
	 * A resource the caller already holds. Settings.vue loads LMS Settings once
	 * and hands it down, so a panel does not re-enter that document.
	 */
	resource?: SettingsDocumentResource
	/**
	 * The fieldname whose value IS the document's name, from the page's
	 * `renameField`. Editing it renames the record instead of writing a field.
	 */
	renameField?: string
	/**
	 * What a new record opens holding. A draft that seeds a value is dirty
	 * against those defaults rather than against emptiness, which is what stops
	 * New reading "Not saved" before anything is typed.
	 */
	defaults?: () => Record<string, unknown>
}

export interface SettingsSourceHandle {
	/** Null while the document loads, and on a source with no record yet. */
	doc: SettingsListRow | null
	/**
	 * The name the record currently answers to; after a rename this differs
	 * from the URL and the source. Lets the page rehash before a refresh
	 * deep-links to a forgotten document.
	 */
	name: string | null
	isDirty: boolean
	/** Writes the document, or inserts the draft when {@link isNew}. */
	save: () => Promise<unknown>
	reload: () => Promise<unknown>
	isNew: boolean
	loading: boolean
}

// createDocumentResource caches on [doctype, name] and ignores `options.cache`,
// so callers naming the same document share one instance. `cache`/`fields` stay
// here only to keep this call byte-identical to Settings.vue and Preferences.vue.
const documentResource = (
	doctype: string,
	name: string
): SettingsDocumentResource => {
	const options =
		doctype === LMS_SETTINGS
			? { doctype, name, fields: ['*'], cache: LMS_SETTINGS, auto: true }
			: { doctype, name, auto: true }
	return createDocumentResource(options) as unknown as SettingsDocumentResource
}

/**
 * Records a confirmed rename in the two copies the resource compares, since
 * nothing downstream will. getChangedFields() drops `name` from every payload,
 * so without this, a save with nothing else to send resolves with no request,
 * and a page renaming through `name` reads unsaved forever. isDirty is settled
 * here because the resource only recomputes it when `doc` mutates, and on this
 * path `doc` mutated before the save, not after.
 */
const settleRenamedName = (
	resource: SettingsDocumentResource,
	renamed: string
) => {
	if (resource.doc) resource.doc.name = renamed
	if (!resource.originalDoc) return
	resource.originalDoc.name = renamed
	resource.isDirty =
		JSON.stringify(resource.doc) !== JSON.stringify(resource.originalDoc)
}

// A draft is dirty once it holds anything worth writing. It has no originalDoc
// to compare against, so this is the closest honest answer to "is there
// something here that is not on the server".
const draftIsDirty = (draft: SettingsListRow): boolean =>
	Object.values(draft).some(
		(value) => value !== null && value !== undefined && value !== ''
	)

/**
 * Resolves a page's {@link SettingsSource} into something a fields panel can
 * read, write and save, whichever of the three kinds of source it is.
 */
export function useSettingsSource(
	source: SettingsSource,
	options: UseSettingsSourceOptions = {}
): SettingsSourceHandle {
	const doctype = 'doctype' in source ? source.doctype : LMS_SETTINGS

	const requested = computed<string | null>(() => {
		if ('doc' in source) return source.doc
		if ('name' in source) return source.name
		return options.record?.value ?? null
	})

	// The name a rename left the record answering to; neither the URL nor the
	// source name it any more. Held here so the open page stays on the record
	// the user just renamed.
	const renamedTo = shallowRef<string | null>(null)

	// Pointing the page at another record ends that hold.
	watch(requested, () => (renamedTo.value = null))

	const target = computed<string | null>(
		() => renamedTo.value ?? requested.value
	)

	const isNew = computed(() => target.value === NEW_RECORD)

	// A record that does not exist yet has no document to load, so it edits a
	// plain object. A fresh one each time, or the draft abandoned on the last New
	// would be waiting in the next one.
	const newDraft = (): SettingsListRow =>
		reactive({ ...(options.defaults?.() ?? {}) })

	const draft = shallowRef<SettingsListRow>(newDraft())
	const pristine = ref(JSON.stringify(draft.value))
	watch(isNew, (value) => {
		if (!value) return
		draft.value = newDraft()
		pristine.value = JSON.stringify(draft.value)
	})

	// In a watcher rather than a computed: createDocumentResource registers in a
	// module-level cache and fires a request, which is not what a computed's
	// getter is allowed to do.
	const resource = shallowRef<SettingsDocumentResource | null>(null)
	watch(
		target,
		(name) => {
			if (options.resource) {
				resource.value = options.resource
				return
			}
			// A rename retargets the resource in place; by now the one already
			// open IS the record the new name refers to. Re-entering it would
			// refetch and discard the copy the save just settled.
			if (resource.value?.name === name) return
			resource.value =
				!name || name === NEW_RECORD ? null : documentResource(doctype, name)
		},
		{ immediate: true }
	)

	// The name the user has edited the record's own name field to, or null when
	// there is nothing to rename. A blank is a half-typed field rather than a
	// name, and a value the record already answers to is not a change.
	const renameTarget = (doc: SettingsListRow | null): string | null => {
		const field = options.renameField
		if (!field || !doc || !(field in doc)) return null
		const value = doc[field]
		if (value === null || value === undefined || String(value).trim() === '')
			return null
		return String(value) === target.value ? null : String(value)
	}

	const save = async (): Promise<unknown> => {
		if (isNew.value) {
			const inserted = await call('frappe.client.insert', {
				doc: { doctype, ...draft.value },
			})
			// The draft has been written, so it is no longer something to discard.
			// Without this a create form navigates away still registered dirty and
			// the guard prompts on top of its own success toast.
			draft.value = newDraft()
			pristine.value = JSON.stringify(draft.value)
			return inserted
		}
		const current = resource.value
		if (!current) return undefined

		const renamed = renameTarget(current.doc)
		if (renamed) {
			// Awaited, and first: a doctype named from a field ignores set_value on
			// that field, so the rename is the only thing that moves the name. A
			// rejected rename must not be followed by the field write.
			await call('frappe.client.rename_doc', {
				doctype,
				old_name: target.value,
				new_name: renamed,
			})
			// The resource builds every request from its own `name` at send time,
			// so it is pointed at the new one before the fields go out. Otherwise
			// the write, and every later reload, addresses a document that is gone.
			current.name = renamed
			renamedTo.value = renamed
			settleRenamedName(current, renamed)
		}
		return current.save.submit()
	}

	const reload = (): Promise<unknown> =>
		resource.value?.reload() ?? Promise.resolve()

	return reactive({
		doc: computed(() =>
			isNew.value ? draft.value : resource.value?.doc ?? null
		),
		name: target,
		isDirty: computed(() => {
			if (!isNew.value) return Boolean(resource.value?.isDirty)
			// Only a seeded draft has a baseline to compare against. Without one the
			// answer stays "does it hold anything worth writing".
			return options.defaults
				? JSON.stringify(draft.value) !== pristine.value
				: draftIsDirty(draft.value)
		}),
		save,
		reload,
		isNew,
		loading: computed(() => Boolean(resource.value?.get?.loading)),
	}) as SettingsSourceHandle
}
