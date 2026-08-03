<template>
	<SettingsLayout :title="label" :description="__(description)">
		<template #header-actions>
			<div
				v-if="saving"
				class="flex items-center gap-x-1 text-ink-amber-6 border border-outline-amber-1 bg-surface-amber-1 rounded-lg px-2 py-1"
			>
				<LoadingIndicator class="size-2" />
				<span class="text-xs">{{ __('saving...') }}</span>
			</div>
			<Button variant="solid" @click="() => showCategoryForm()">
				<template #prefix>
					<span v-if="!showForm" class="lucide-plus h-4 w-4" />
					<span v-else class="lucide-x h-4 w-4" />
				</template>
				{{ showForm ? __('Close') : __('New') }}
			</Button>
		</template>

		<template #header-bottom>
			<div v-if="showForm" class="flex items-center justify-between gap-x-2">
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

		<List
			v-if="categories.data?.length"
			:columns="columns"
			class="list-row-px-3 [--list-row-height:3.5rem]"
		>
			<ListHeader>
				<ListHeaderCell>{{ __('Category') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Created') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows :items="categories.data" row-key="name" v-slot="{ item: row }">
				<ListRow>
					<ListCell>
						<span class="truncate text-p-base text-ink-gray-8">
							{{ row.category }}
						</span>
					</ListCell>
					<ListCell class="text-p-base text-ink-gray-6">
						<span class="truncate">
							{{ dayjs(row.creation).format('DD MMM YYYY') }}
						</span>
					</ListCell>
					<ListCell @click.stop>
						<Dropdown
							:options="[
								{
									label: __('Edit'),
									icon: 'lucide-pencil',
									onClick: () => promptRename(row),
								},
								{
									label: __('Delete'),
									icon: 'lucide-trash-2',
									onClick: () => confirmDeletion(row),
								},
							]"
							:button="{
								icon: 'lucide-more-horizontal',
								variant: 'ghost',
								label: __('Category actions'),
							}"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>
		<EmptyStateLayout
			v-else
			name="Categories"
			:description="__('Add one to get started.')"
			icon="lucide-network"
		/>
	</SettingsLayout>

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
<script setup>
import {
	Button,
	Dialog,
	Dropdown,
	FormControl,
	LoadingIndicator,
	call,
	createListResource,
	createResource,
	toast,
} from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { nextTick, ref } from 'vue'
import { cleanError } from '@/utils'
import { createDialog } from '@/utils/dialogs'
import dayjs from '@/utils/dayjs'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const showForm = ref(false)
const category = ref(null)
const categoryInput = ref(null)
const saving = ref(false)
const editing = ref(null)
const editedValue = ref('')
const renameOpen = ref(false)
const renameInput = ref(null)

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: '',
	},
})

// Grid track sizes shared by the header and every row (--list-columns).
const columns = ['minmax(0, 1fr)', '12rem', '2.25rem']

const categories = createListResource({
	doctype: 'LMS Category',
	fields: ['name', 'category', 'creation'],
	orderBy: 'creation desc',
	auto: true,
})

const focusInput = (el) => {
	nextTick(() => el?.$el?.querySelector('input')?.focus())
}

const addCategory = () => {
	if (!category.value) return
	categories.insert.submit(
		{
			category: category.value,
		},
		{
			onSuccess() {
				categories.reload()
				category.value = null
				showForm.value = false
				toast.success(__('Category added successfully'))
			},
			onError(err) {
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
	makeParams(values) {
		return {
			doctype: 'LMS Category',
			old_name: values.name,
			new_name: values.category,
		}
	},
})

const promptRename = (row) => {
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
		variant: 'solid',
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
				categories.reload()
				cancelEdit()
				toast.success(__('Category updated successfully'))
			},
			onError(err) {
				saving.value = false
				cancelEdit()
				toast.error(
					__(cleanError(err.messages[0]) || 'Unable to update category')
				)
			},
		}
	)
}

const confirmDeletion = (row) => {
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
				onClick({ close }) {
					deleteCategory(row.name, close)
				},
			},
		],
	})
}

// Category is a Link target on both LMS Course and LMS Batch, so the server
// clears those references before deleting; a plain delete raises LinkExistsError.
const deleteCategory = (name, close) => {
	saving.value = true
	call('lms.lms.api.delete_category', { category: name })
		.then(() => {
			categories.reload()
			if (typeof close === 'function') close()
			toast.success(__('Category deleted successfully'))
		})
		.catch((err) => {
			toast.error(
				__(cleanError(err.messages?.[0] || err) || 'Unable to delete category')
			)
		})
		.finally(() => {
			saving.value = false
		})
}
</script>
