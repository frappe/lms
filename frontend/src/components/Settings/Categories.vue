<template>
	<SettingsList
		:title="label"
		:description="__(description)"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search categories')"
		:new-label="showForm ? __('Close') : __('New')"
		empty-name="Categories"
		empty-icon="lucide-network"
		@new="showCategoryForm()"
		@load-more="list.loadMore()"
		@row-click="promptRename"
	>
		<template #header-actions>
			<div
				v-if="saving"
				class="flex items-center gap-x-1 text-ink-amber-6 border border-outline-amber-1 bg-surface-amber-1 rounded-lg px-2 py-1"
			>
				<LoadingIndicator class="size-2" />
				<span class="text-xs">{{ __('saving...') }}</span>
			</div>
		</template>

		<template #header-bottom>
			<div v-if="showForm" class="flex flex-1 items-center justify-end gap-x-2">
				<FormControl
					ref="categoryInput"
					v-model="category"
					:placeholder="__('Category Name')"
					class="flex-1"
					@keyup.enter="addCategory()"
				/>
				<Button @click="addCategory()" variant="subtle">
					{{ __('Add') }}
				</Button>
			</div>
		</template>
	</SettingsList>

	<Dialog
		v-model="renameOpen"
		:title="__('Edit category')"
		size="sm"
		:actions="renameActions"
	>
		<FormControl
			ref="renameInput"
			v-model="editedValue"
			type="text"
			:label="__('Name')"
			@keyup.enter="saveChanges()"
		/>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Button,
	Dialog,
	FormControl,
	LoadingIndicator,
	call,
	createResource,
	toast,
} from 'frappe-ui'
import { nextTick, ref } from 'vue'
import { cleanError } from '@/utils'
import { createDialog } from '@/utils/dialogs'
import dayjs from '@/utils/dayjs'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const showForm = ref(false)
const category = ref<string | null>(null)
const categoryInput = ref<any>(null)
const saving = ref(false)
const editing = ref<string | null>(null)
const editedValue = ref('')
const renameOpen = ref(false)
const renameInput = ref<any>(null)

withDefaults(
	defineProps<{
		label: string
		description?: string
	}>(),
	{ description: '' }
)

const list = useSettingsListResource({
	doctype: 'LMS Category',
	fields: ['name', 'category', 'creation'],
	searchFields: ['category'],
	orderBy: 'creation desc',
})

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

const focusInput = (el: any) => {
	nextTick(() => el?.$el?.querySelector('input')?.focus())
}

const addCategory = () => {
	if (!category.value) return
	list.resource.insert.submit(
		{
			category: category.value,
		},
		{
			onSuccess() {
				list.reload()
				category.value = null
				showForm.value = false
				toast.success(__('Category added successfully'))
			},
			onError(err: any) {
				toast.error(__(cleanError(err.messages[0]) || 'Unable to add category'))
			},
		}
	)
}

const showCategoryForm = () => {
	showForm.value = !showForm.value
	if (showForm.value) focusInput(categoryInput.value)
}

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

const promptRename = (row: SettingsListRow) => {
	editing.value = row.name
	editedValue.value = row.category
	renameOpen.value = true
	focusInput(renameInput.value)
}

const cancelEdit = () => {
	editing.value = null
	editedValue.value = ''
	renameOpen.value = false
}

const renameActions = [
	{
		label: __('Save'),
		variant: 'solid' as const,
		onClick: () => saveChanges(),
	},
]

const saveChanges = () => {
	const name = editing.value
	const value = editedValue.value?.trim()
	if (!value || value === name) {
		cancelEdit()
		return
	}
	saving.value = true
	updateCategory.submit(
		{
			name: name,
			category: value,
		},
		{
			onSuccess() {
				saving.value = false
				list.reload()
				cancelEdit()
				toast.success(__('Category updated successfully'))
			},
			onError(err: any) {
				saving.value = false
				cancelEdit()
				toast.error(
					__(cleanError(err.messages[0]) || 'Unable to update category')
				)
			},
		}
	)
}

// LMS Category is a Link target on Course and Batch, so the server unlinks
// before deleting; a plain delete raises LinkExistsError.
const deleteCategory = (name: string, close: () => void) => {
	saving.value = true
	call('lms.lms.api.delete_category', { category: name })
		.then(() => {
			list.reload()
			if (typeof close === 'function') close()
			toast.success(__('Category deleted successfully'))
		})
		.catch((err: any) => {
			toast.error(
				__(cleanError(err.messages?.[0] || err) || 'Unable to delete category')
			)
		})
		.finally(() => {
			saving.value = false
		})
}
</script>
