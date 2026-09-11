<template>
	<SettingsLayout
		:title="heading"
		:show-back="showBack"
		:save-state="autosave?.status.value"
		:unsaved="autosave ? undefined : hasPendingChanges"
		:save-label="autosave ? undefined : __('Save')"
		:saving="saving"
		:can-save="hasPendingChanges"
		save-testid="settings-fields-save"
		v-model:enabled="enabled"
		@back="emit('back')"
		@save="save"
	>
		<SettingsFields
			v-if="source.doc"
			:key="fieldsKey"
			:sections="sections"
			:data="source.doc"
			:flush="showBack && !page.dividers"
			@commit="commit"
			@secret="onSecret"
		/>
		<div v-if="page.extra" class="mt-6">
			<component :is="page.extra.component" />
		</div>
	</SettingsLayout>
</template>

<script lang="ts">
import type { FieldMeta, FieldsSection } from '@/types/settingsSchema'

/**
 * Lays the server's `reqd` over each field's static one. Pure, and returns
 * new objects: the schema is a module-level constant shared by every mount,
 * so mutating it would leak into the next page reading the same field.
 */
export function applyFieldMeta(
	sections: FieldsSection[],
	meta: FieldMeta | null
): FieldsSection[] {
	if (!meta) return sections
	return sections.map((section) => ({
		...section,
		fields: section.fields.map((field) => {
			const reqd = meta[field.name]?.reqd
			return reqd === undefined ? field : { ...field, reqd: Boolean(reqd) }
		}),
	}))
}
</script>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { call, toast } from 'frappe-ui'
import SettingsFields from '@/components/Layouts/settings/desktop/SettingsFields.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import { useAutosave, type CommitMode } from '@/composables/useAutosave'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import {
	useSettingsSource,
	type SettingsDocumentResource,
} from '@/composables/useSettingsSource'
import type { FieldsPage } from '@/types/settingsSchema'

const props = defineProps<{
	page: FieldsPage
	title?: string
	showBack?: boolean
	/** The record id, for a page whose source takes one from the route. */
	record?: string | null
	/**
	 * A resource the caller already loaded. Settings.vue holds LMS Settings, so
	 * a panel over it is handed the document rather than entering it again.
	 */
	data?: SettingsDocumentResource
}>()

const emit = defineEmits<{ back: []; renamed: [string] }>()

const source = useSettingsSource(props.page.source, {
	record: computed(() => props.record ?? null),
	resource: props.data,
	renameField: props.page.renameField,
	defaults: props.page.defaults,
})

// Needed again here because a `secret` field's own set_value call names a
// doctype the diffed save() call never does.
const secretDoctype =
	'doctype' in props.page.source ? props.page.source.doctype : 'LMS Settings'

// A `secret` field's typed value, held here rather than on source.doc. See
// the schema's own note on why. `fieldsKey` remounts SettingsFields once the
// write lands, clearing the box back to its placeholder.
const pendingSecrets = reactive<Record<string, string>>({})
const onSecret = (fieldname: string, value: string) => {
	if (value) pendingSecrets[fieldname] = value
	else delete pendingSecrets[fieldname]
}
const hasPendingChanges = computed(
	() => source.isDirty || Object.keys(pendingSecrets).length > 0
)
const fieldsKey = ref(0)

// A panel whose every section carries a heading needs no title above them,
// since they'd say the same thing twice. A back control is exempt: there
// the title is the way out of the page, not a heading.
const heading = computed(() => {
	if (props.showBack) return props.title
	const sections = props.page.sections
	const headed = sections.length > 0 && sections.every((s) => s.label)
	return headed ? undefined : props.title
})

// Uses frappe-ui's own isDirty and save: submit() skips the round trip when
// nothing changed, and the resource re-clones originalDoc on success. No
// toast: a failed write just leaves the header reading "Not saved".
const autosave =
	props.page.save === 'auto'
		? useAutosave({
				isDirty: () => source.isDirty,
				write: () => source.save(),
		  })
		: null

// Only the manual path registers. Settings.vue mounts every panel at once, so
// an unwatched autosave panel would register too and stay dirty for good
// after a refused write, prompting on tab change with no Save to offer.
if (!autosave)
	useDirtyGuard(
		() => source.isDirty,
		() => void source.reload()
	)

// SettingsFields reports every settled edit whether or not anyone listens.
// 'cancel' is a withdrawal, not a write: a bounded field went out of bounds
// mid-type, so the rest period armed by its last valid keystroke must be
// disarmed before it fires against a value validate() would reject.
const commit = (mode: CommitMode | 'cancel') =>
	mode === 'cancel' ? autosave?.cancel() : autosave?.commit(mode)

// A rename moves the record out from under the URL, so a refresh would
// deep-link to nothing. The panel doesn't own the hash, so it reports the
// move for the page above to rehash. Compared against the PREVIOUS name,
// not the record prop, since a panel opened from a list gets no prop at all.
watch(
	() => source.name,
	(name, previous) => {
		if (name && previous && name !== previous) emit('renamed', name)
	}
)

const saving = ref(false)

const firstProblem = (): string => {
	if (!source.doc) return ''
	return props.page.validate?.(source.doc) ?? ''
}

const reportFailure = (error: { messages?: string[]; message?: string }) => {
	toast.error(error?.messages?.[0] || error?.message || __('Save failed'))
	console.error(error)
}

const save = () => {
	const invalid = firstProblem()
	if (invalid) {
		toast.error(invalid)
		return
	}
	saving.value = true
	const created = source.isNew
	const finish = () =>
		props.page.onSaved?.({
			created,
			name: source.name,
			back: () => emit('back'),
		})

	// Sequenced, not Promise.all. A new record's real name only exists once
	// this resolves, and a secret write needs that name, not NEW_RECORD.
	source
		.save()
		.then(async () => {
			const entries = Object.entries(pendingSecrets)
			if (entries.length) {
				await Promise.all(
					entries.map(([fieldname, value]) =>
						call('frappe.client.set_value', {
							doctype: secretDoctype,
							name: source.name,
							fieldname,
							value,
						})
					)
				)
				for (const key of Object.keys(pendingSecrets))
					delete pendingSecrets[key]
				fieldsKey.value += 1
			}
			return finish()
		})
		.catch(reportFailure)
		.finally(() => (saving.value = false))
}

const meta = ref<FieldMeta | null>(null)

// Fetched once, on mount: `reqd` is a doctype's declaration and does not
// change while the page is open.
onMounted(() => {
	props.page
		.meta?.()
		.then((data) => (meta.value = data))
		.catch((error: unknown) => console.error(error))
})

// `enabledField` hoists one Check into the header beside Save, where every
// other settings record draws its on/off state. Removed from the sections
// here rather than the page's schema, so a page opts in with one key.
const sections = computed(() => {
	const withMeta = applyFieldMeta(props.page.sections, meta.value)
	const hoisted = props.page.enabledField
	if (!hoisted) return withMeta
	return withMeta.map((section) => ({
		...section,
		fields: section.fields.filter((field) => field.name !== hoisted),
	}))
})

// The doctype stores a Check as 0/1 and the header switch speaks booleans.
// Undefined when the page hoists nothing or the document has not landed, which
// is what keeps the switch off every other panel's header.
const enabled = computed<boolean | undefined>({
	get: () => {
		const field = props.page.enabledField
		if (!field || !source.doc) return undefined
		return Boolean(source.doc[field])
	},
	set: (value) => {
		const field = props.page.enabledField
		if (field && source.doc) source.doc[field] = value ? 1 : 0
	},
})
</script>
