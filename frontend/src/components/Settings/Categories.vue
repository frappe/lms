<template>
	<SettingsList
		:title="label"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:new-label="showForm ? __('Close') : __('New')"
		empty-name="Categories"
		empty-icon="lucide-network"
		@new="openForm()"
		@load-more="list.loadMore()"
		@row-click="openForm"
	>
		<template #header-actions>
			<div
				v-if="deleting"
				class="flex items-center gap-x-1 text-ink-amber-6 border border-outline-amber-1 bg-surface-amber-1 rounded-lg px-2 py-1"
			>
				<LoadingIndicator class="size-2" />
				<span class="text-xs">{{ __('saving...') }}</span>
			</div>
		</template>
	</SettingsList>

	<Dialog
		v-model="showForm"
		:title="isNew ? __('New Category') : __('Edit Category')"
		size="sm"
		:actions="actions"
	>
		<template #default>
			<div class="space-y-4">
				<FormControl
					v-model="draft"
					type="text"
					:label="__('Name')"
					:placeholder="__('Category name')"
					:required="true"
					autofocus
					@keyup.enter="save()"
				/>
				<ErrorMessage :message="error" />
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Dialog,
	ErrorMessage,
	FormControl,
	LoadingIndicator,
	call,
	createResource,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { cleanError } from '@/utils'
import { createDialog } from '@/utils/dialogs'
import dayjs from '@/utils/dayjs'
import SettingsList from '@/components/Layouts/settings/desktop/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const showForm = ref(false)
const draft = ref('')
// The name the dialog opened on, which is both the record it writes to and the
// value an edit is dirty against. Null is what makes the dialog a create.
const editing = ref<string | null>(null)
const loaded = ref('')
const error = ref('')
const saving = ref(false)
const deleting = ref(false)

// A save the dialog has already moved on from (reopened on another row, or
// on New) must not close what is open now or write its error under it.
// Only the newest one is still allowed to land.
let saveToken = 0

defineProps<{
	label: string
}>()

const list = useSettingsListResource({
	doctype: 'LMS Category',
	fields: ['name', 'category', 'creation'],
	searchFields: ['category'],
	orderBy: 'creation desc',
})

const isNew = computed(() => editing.value === null)

// useSettingsSource's split, over the one field this doctype has: a draft is
// dirty once it holds something worth writing, and a loaded record once its
// value differs from the one it came with.
const isDirty = computed(() => {
	const value = draft.value.trim()
	if (!value) return false
	return isNew.value ? true : value !== loaded.value
})

const actions = computed(() => [
	{
		label: isNew.value ? __('Create') : __('Save'),
		variant: 'solid' as const,
		disabled: !isDirty.value,
		onClick: () => save(),
	},
])

// The dialog is one form in two states, so opening it is what loads it:
// from the row for an edit, from nothing for a create.
const openForm = (row?: SettingsListRow) => {
	saveToken++
	saving.value = false
	editing.value = row?.name ?? null
	loaded.value = row?.category ?? ''
	draft.value = loaded.value
	error.value = ''
	showForm.value = true
}

const messageOf = (err: any, fallback: string): string => {
	const message = err?.messages?.[0] || err?.message || err
	return (typeof message === 'string' && cleanError(message)) || fallback
}

// A refused write keeps the dialog, and what was typed, where it is, and
// puts the server's message under the field.
const onSaveError = (err: any, fallback: string) => {
	saving.value = false
	error.value = messageOf(err, fallback)
}

const onSaved = (message: string) => {
	saving.value = false
	showForm.value = false
	list.reload()
	toast.success(message)
}

// LMS Category is named `field:category` with the field itself unique, so the
// name IS the category and editing it is a rename rather than a field write.
const updateCategory = createResource({
	url: 'frappe.client.rename_doc',
	makeParams(values: { name: string; category: string }) {
		return {
			doctype: 'LMS Category',
			old_name: values.name,
			new_name: values.category,
		}
	},
})

// Returns a promise, which is what Dialog keeps the action button loading on
// until the request settles either way.
const save = (): Promise<void> => {
	if (!isDirty.value || saving.value) return Promise.resolve()
	const value = draft.value.trim()
	error.value = ''
	saving.value = true
	const token = ++saveToken

	return new Promise<void>((resolve) => {
		const callbacks = (saved: string, fallback: string) => ({
			onSuccess: () => {
				if (token === saveToken) onSaved(saved)
				resolve()
			},
			onError: (err: any) => {
				if (token === saveToken) onSaveError(err, fallback)
				resolve()
			},
		})

		if (isNew.value) {
			list.resource.insert.submit(
				{ category: value },
				callbacks(
					__('Category added successfully'),
					__('Unable to add category')
				)
			)
			return
		}

		updateCategory.submit(
			{ name: editing.value, category: value },
			callbacks(
				__('Category updated successfully'),
				__('Unable to update category')
			)
		)
	})
}

const confirmDeletion = (row: SettingsListRow) => {
	createDialog({
		title: __('Delete this category?'),
		message: __(
			'This will unlink this category from all courses and batches using it, and then delete it. This cannot be undone.'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					deleteCategory(row.name, close)
				},
			},
		],
	})
}

const columns: SettingsListColumn[] = [
	{
		key: 'category',
		label: __('Category'),
		type: 'stacked',
		primary: (row) => row.category,
	},
	{
		key: 'creation',
		label: __('Created'),
		type: 'text',
		width: '12rem',
		value: (row) => dayjs(row.creation).format('DD MMM YYYY'),
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.category),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => confirmDeletion(row),
			},
		],
	},
]

// LMS Category is a Link target on Course and Batch, so the server unlinks
// before deleting; a plain delete raises LinkExistsError.
const deleteCategory = (name: string, close: () => void) => {
	deleting.value = true
	call('lms.lms.api.delete_category', { category: name })
		.then(() => {
			list.reload()
			if (typeof close === 'function') close()
			toast.success(__('Category deleted successfully'))
		})
		.catch((err: any) => {
			toast.error(messageOf(err, __('Unable to delete category')))
		})
		.finally(() => {
			deleting.value = false
		})
}
</script>
