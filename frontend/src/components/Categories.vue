<template>
	<div class="flex flex-col min-h-0">
		<div class="flex items-center justify-between">
			<div class="text-xl font-semibold mb-5 text-ink-gray-9">
				{{ label }}
			</div>
			<Button @click="() => showCategoryForm()">
				<template #prefix>
					<Plus v-if="!showForm" class="h-3 w-3 stroke-1.5" />
					<X v-else class="h-3 w-3 stroke-1.5" />
				</template>
				{{ showForm ? __('Close') : __('New') }}
			</Button>
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
			<div class="text-base space-y-2">
				<FormControl
					:value="cat.category"
					type="text"
					v-for="cat in categories.data"
					@change.stop="(e) => update(cat.name, e.target.value)"
				/>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Button,
	FormControl,
	createListResource,
	createResource,
	debounce,
} from 'frappe-ui'
import { Plus, X } from 'lucide-vue-next'
import { ref } from 'vue'

const showForm = ref(false)
const category = ref(null)
const categoryInput = ref(null)

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

const newCategory = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Category',
				category: category.value,
			},
		}
	},
})

const addCategory = () => {
	newCategory.submit(
		{},
		{
			onSuccess(data) {
				categories.reload()
				category.value = null
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
	updateCategory.submit(
		{
			name: name,
			category: value,
		},
		{
			onSuccess() {
				categories.reload()
			},
		}
	)
}
</script>
