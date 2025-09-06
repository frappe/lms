<template>
	<div class="flex flex-col min-h-0 text-base">
		<div class="flex items-center justify-between mb-5">
			<div class="flex flex-col space-y-2">
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ label }}
				</div>
				<div class="text-xs text-ink-gray-5">
					{{ __(description) }}
				</div>
			</div>
			<div class="flex items-center space-x-5">
				<div
					class="flex items-center space-x-1 text-ink-amber-3 border border-outline-amber-1 bg-surface-amber-1 rounded-lg px-2 py-1"
					v-if="saving"
				>
					<LoadingIndicator class="size-2" />
					<span class="text-xs">
						{{ __('saving...') }}
					</span>
				</div>
				<Button @click="() => showCategoryForm()">
					<template #prefix>
						<Plus v-if="!showForm" class="h-3 w-3 stroke-1.5" />
						<X v-else class="h-3 w-3 stroke-1.5" />
					</template>
					{{ showForm ? __('Close') : __('New') }}
				</Button>
			</div>
		</div>

		<div
			v-if="showForm"
			class="flex items-center justify-between my-4 space-x-2"
		>
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

		<div class="overflow-y-scroll">
			<div class="divide-y space-y-2">
				<div
					v-for="(cat, index) in categories.data"
					:key="cat.name"
					class="pt-2"
				>
					<div
						v-if="editing?.name !== cat.name"
						class="flex items-center justify-between group text-sm"
					>
						<div @dblclick="allowEdit(cat, index)">
							{{ cat.category }}
						</div>
						<Button
							variant="ghost"
							theme="red"
							class="invisible group-hover:visible"
							@click="deleteCategory(cat.name)"
						>
							<template #icon>
								<Trash2 class="size-4 stroke-1.5 text-ink-red-4" />
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
		</div>
	</div>
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
import { Plus, Trash2, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { cleanError } from '@/utils'

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
