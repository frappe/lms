<template>
	<div>
		<label v-if="label" class="block mb-1" :class="labelClasses">
			{{ label }}
			<span v-if="required" class="text-ink-red-3">*</span>
		</label>
		<Combobox v-model="selectedValue" nullable v-slot="{ open }">
			<div class="relative w-full">
				<ComboboxInput
					ref="search"
					class="form-input w-full focus-visible:!ring-0"
					type="text"
					:displayValue="() => query"
					@change="
						(e) => {
							query = e.target.value
						}
					"
					autocomplete="off"
					@focus="onFocus"
				/>
				<ComboboxButton ref="trigger" class="hidden" />
				<ComboboxOptions
					v-show="open"
					static
					class="absolute z-20 mt-1 w-full rounded-lg bg-surface-modal border-2 border-outline-gray-modals max-h-[13rem] flex flex-col"
				>
					<div
						class="flex-1 my-1 overflow-y-auto px-1.5"
						:class="options.length ? 'min-h-[6rem]' : 'min-h-[3.8rem]'"
					>
						<template v-if="options.length">
							<ComboboxOption
								v-for="option in options"
								:key="option.value"
								:value="option"
								v-slot="{ active }"
							>
								<li
									:class="[
										'flex cursor-pointer items-center rounded px-2 py-1 text-base',
										{ 'bg-surface-gray-2': active },
									]"
								>
									<div class="flex flex-col gap-1 p-1">
										<div class="text-base font-medium text-ink-gray-8">
											{{
												option.value === option.label
													? option.description
													: option.label
											}}
										</div>
										<div class="text-sm text-ink-gray-5">
											{{ option.value }}
										</div>
									</div>
								</li>
							</ComboboxOption>
						</template>

						<div v-else class="text-ink-gray-7 px-4 py-2">
							{{ __('No results found') }}
						</div>
					</div>

					<div
						v-if="attrs.onCreate"
						class="p-1 bg-surface-white border-t rounded-b-lg"
					>
						<Button
							variant="ghost"
							class="w-full !justify-start"
							:label="__('Create New')"
							@click="attrs.onCreate()"
						>
							<template #prefix>
								<Plus class="h-4 w-4 stroke-1.5" />
							</template>
						</Button>
					</div>
				</ComboboxOptions>
			</div>
		</Combobox>

		<!-- Selected values -->
		<div v-if="values?.length" class="grid grid-cols-2 gap-2 mt-1">
			<div
				v-for="value in values"
				:key="value"
				class="flex items-center justify-between break-all bg-surface-gray-2 text-ink-gray-7 p-2 rounded-md"
			>
				<span>{{ value }}</span>
				<X
					class="size-4 stroke-1.5 cursor-pointer"
					@click="removeValue(value)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
import {
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOptions,
	ComboboxOption,
} from '@headlessui/vue'
import { createResource, Button, toast } from 'frappe-ui'
import { ref, computed, useAttrs, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { X, Plus } from 'lucide-vue-next'

const props = defineProps({
	label: String,
	size: { type: String, default: 'sm' },
	doctype: { type: String, required: true },
	filters: { type: [Object, Array], default: () => ({}) },
	url: { type: String, default: 'frappe.desk.search.search_link' },
	searchParams: { type: Object, default: () => ({}) },
	validate: Function,
	errorMessage: {
		type: Function,
		default: (value) => `${value} is an Invalid value`,
	},
	required: Boolean,
})

const values = defineModel({ default: () => [] })
const attrs = useAttrs()
const trigger = ref(null)
const query = ref('')
const text = ref('')
const selectedValue = ref(null)

watch(selectedValue, (val) => {
	if (!val?.value) return
	query.value = ''
	addValue(val.value)
	selectedValue.value = null
})

watchDebounced(
	query,
	(val) => {
		val = val || ''
		if (text.value === val) return
		text.value = val
		reload(val)
	},
	{ debounce: 300, immediate: true }
)

// Refetch when filters or searchParams change
watch(
	() => [props.filters, props.searchParams],
	() => {
		reload(text.value)
	},
	{ deep: true }
)

function getParams(txt) {
	return {
		txt,
		doctype: props.doctype,
		filters: JSON.stringify(props.filters),
		...props.searchParams,
	}
}

const filterOptions = createResource({
	url: props.url,
	method: 'POST',
})

const options = computed(() => {
	const allOptions = filterOptions.data || []
	return allOptions.filter((option) => !values.value?.includes(option.value))
})

function reload(val) {
	filterOptions.update({
		params: getParams(val),
	})
	filterOptions.reload()
}

function onFocus() {
	if (!filterOptions.data?.length) {
		reload('')
	}
	trigger.value?.$el.click()
}

function addValue(value) {
	if (!value) return

	const splitValues = value.split(',')
	let newValues = [...(values.value || [])]

	splitValues.forEach((val) => {
		val = val.trim()

		if (!val) return
		if (newValues.includes(val)) return

		if (props.validate && !props.validate(val)) {
			toast.error(props.errorMessage(val))
			return
		}

		newValues.push(val)
	})

	values.value = newValues
}

function removeValue(value) {
	values.value = values.value.filter((v) => v !== value)
}

const labelClasses = computed(() => [
	{ sm: 'text-xs', md: 'text-base' }[props.size || 'sm'],
	'text-ink-gray-5',
])
</script>
