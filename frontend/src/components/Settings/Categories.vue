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
				/>
				<Button @click="addCategory()" variant="subtle">
					{{ __('Add') }}
				</Button>
			</div>
		</template>

		<div
			class="divide-y divide-outline-elevation-2"
			v-if="categories.data?.length"
		>
			<div v-for="(cat, index) in categories.data" :key="cat.name" class="pt-2">
				<div
					v-if="editing?.name !== cat.name"
					class="flex items-center justify-between group text-sm text-ink-gray-9"
				>
					<div class="text-ink-gray-9" @dblclick="allowEdit(cat, index)">
						{{ cat.category }}
					</div>
					<Button
						variant="ghost"
						theme="red"
						class="invisible group-hover:visible"
						@click="deleteCategory(cat.name)"
					>
						<template #icon>
							<span class="lucide-trash-2 size-4 text-ink-red-8" />
						</template>
					</Button>
				</div>
				<FormControl
					v-else
					:ref="(el) => (editInputRef[index] = el)"
					v-model="editedValue"
					type="text"
					class="w-full"
					@keyup.enter="saveChanges(cat.name, editedValue)"
				/>
			</div>
		</div>
		<EmptyStateLayout
			v-else
			name="Categories"
			:description="__('Add one to get started.')"
			icon="lucide-network"
		/>
	</SettingsLayout>
</template>
<script setup>
import {
	Button,
	FormControl,
	LoadingIndicator,
	createListResource,
	createResource,
	toast,
} from 'frappe-ui'
import { ref } from 'vue'
import { cleanError } from '@/utils'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const showForm = ref(false)
const category = ref(null)
const categoryInput = ref(null)
const saving = ref(false)
const editing = ref(null)
const editedValue = ref('')
const editInputRef = ref([])

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

const categories = createListResource({
	doctype: 'LMS Category',
	fields: ['name', 'category'],
	auto: true,
})

const addCategory = () => {
	categories.insert.submit(
		{
			category: category.value,
		},
		{
			onSuccess(data) {
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
	setTimeout(() => {
		categoryInput.value.$el.querySelector('input').focus()
	}, 0)
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

const update = (name, value) => {
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
				editing.value = null
				editedValue.value = ''
				toast.success(__('Category updated successfully'))
			},
			onError(err) {
				saving.value = false
				editing.value = null
				editedValue.value = ''
				toast.error(
					__(cleanError(err.messages[0]) || 'Unable to update category')
				)
			},
		}
	)
}

const deleteCategory = (name) => {
	saving.value = true
	categories.delete.submit(name, {
		onSuccess() {
			saving.value = false
			categories.reload()
			toast.success(__('Category deleted successfully'))
		},
		onError(err) {
			saving.value = false
			toast.error(
				__(cleanError(err.messages[0]) || 'Unable to delete category')
			)
		},
	})
}

const saveChanges = (name, value) => {
	saving.value = true
	update(name, value)
}

const allowEdit = (cat, index) => {
	editing.value = cat
	editedValue.value = cat.category
	setTimeout(() => {
		editInputRef.value[index].$el.querySelector('input').focus()
	}, 0)
}
</script>
