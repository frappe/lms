import {
	computed,
	type ComputedRef,
	type Ref,
	type WritableComputedRef,
} from 'vue'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import {
	useSettingsSource,
	type SettingsSourceHandle,
} from '@/composables/useSettingsSource'
import type { SettingsListRow } from '@/types'

export interface UseSettingsRecordOptions {
	doctype: string
	/** The record the panel opened, from the form's own `name` prop. */
	record: Ref<string | null> | ComputedRef<string | null>
	/**
	 * The fieldname whose value IS the document's name. A doctype that
	 * autonames `field:X` drops a set_value on X, so only a rename moves it.
	 */
	renameField?: string
	/**
	 * The Check field the header switch writes. Defaults to `enabled`; a
	 * payment's is `payment_received`.
	 */
	enabledField?: string
	/**
	 * Replaces the dirty computation, handed the source to read its own
	 * answer. Most forms only add to it (`source.isDirty || mine`); a draft
	 * with defaults of its own must ignore it, since a seeded draft already
	 * satisfies the source's "holds anything at all" before being touched.
	 */
	dirty?: (source: SettingsSourceHandle) => boolean
}

export interface SettingsRecordHandle {
	source: SettingsSourceHandle
	doc: ComputedRef<SettingsListRow | null>
	isNew: ComputedRef<boolean>
	isDirty: ComputedRef<boolean>
	loading: ComputedRef<boolean>
	/** The name the record answers to now, which a rename has moved. */
	name: ComputedRef<string | null>
	/**
	 * The record's on/off state, as the header switch's boolean over the
	 * doctype's 0/1. Undefined while there is no document, hiding the switch.
	 */
	enabled: WritableComputedRef<boolean | undefined>
}

/**
 * The state every settings record form holds: document, isNew, isDirty, the
 * dirty guard, and the header switch. Save, validation and seeding differ
 * per form and live elsewhere (see {@link runSave}). Email Accounts and
 * Payment Gateways can't use this: neither is a plain document resource.
 */
export function useSettingsRecord(
	options: UseSettingsRecordOptions
): SettingsRecordHandle {
	const source = useSettingsSource(
		{ doctype: options.doctype, record: 'route' },
		{ record: options.record, renameField: options.renameField }
	)

	const doc = computed(() => source.doc)
	const enabledField = options.enabledField ?? 'enabled'

	const isDirty = computed(() =>
		options.dirty ? Boolean(options.dirty(source)) : source.isDirty
	)

	useDirtyGuard(() => isDirty.value)

	const enabled = computed<boolean | undefined>({
		get: () => (doc.value ? Boolean(doc.value[enabledField]) : undefined),
		set: (value) => {
			if (doc.value) doc.value[enabledField] = value ? 1 : 0
		},
	})

	return {
		source,
		doc,
		isNew: computed(() => source.isNew),
		isDirty,
		loading: computed(() => source.loading),
		name: computed(() => source.name),
		enabled,
	}
}
