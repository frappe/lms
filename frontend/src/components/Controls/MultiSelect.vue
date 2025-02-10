<template>
	<div>
		<label class="block mb-1" :class="labelClasses" v-if="label">
			{{ label }}
			<span class="text-ink-red-3" v-if="required">*</span>
		</label>
		<div class="grid grid-cols-3 gap-1">
			<Button
				ref="emails"
				v-for="value in values"
				:key="value"
				:label="value"
				theme="gray"
				variant="subtle"
				class="rounded-md"
				@keydown.delete.capture.stop="removeLastValue"
			>
				<template #suffix>
					<X @click="removeValue(value)" class="h-4 w-4 stroke-1.5" />
				</template>
			</Button>
			<div class="">
				<Combobox v-model="selectedValue" nullable>
					<Popover class="w-full" v-model:show="showOptions">
						<template #target="{ togglePopover }">
							<ComboboxInput
								ref="search"
								class="search-input form-input w-full focus-visible:!ring-0"
								type="text"
								:value="query"
								@change="
									(e) => {
										query = e.target.value
										showOptions = true
									}
								"
								autocomplete="off"
								@focus="() => togglePopover()"
								@keydown.delete.capture.stop="removeLastValue"
							/>
						</template>
						<template #body="{ isOpen }">
							<div v-show="isOpen">
								<div
									class="mt-1 rounded-lg bg-surface-white py-1 text-base shadow-2xl"
								>
									<ComboboxOptions
										class="my-1 max-h-[12rem] overflow-y-auto px-1.5"
										static
									>
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
													<div class="text-base font-medium">
														{{ option.description }}
													</div>
													<div class="text-sm text-ink-gray-5">
														{{ option.value }}
													</div>
												</div>
											</li>
										</ComboboxOption>
									</ComboboxOptions>
								</div>
							</div>
						</template>
					</Popover>
				</Combobox>
			</div>
		</div>
		<!-- <ErrorMessage class="mt-2 pl-2" v-if="error" :message="error" /> -->
	</div>
</template>

<script setup>
import {
	Combobox,
	ComboboxInput,
	ComboboxOptions,
	ComboboxOption,
} from '@headlessui/vue'
import { createResource, Popover, Button } from 'frappe-ui'
import { ref, computed, nextTick } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { X } from 'lucide-vue-next'

const props = defineProps({
	label: {
		type: String,
	},
	size: {
		type: String,
		default: 'sm',
	},
	doctype: {
		type: String,
		required: true,
	},
	filters: {
		type: Object,
		default: () => ({}),
	},
	validate: {
		type: Function,
		default: null,
	},
	errorMessage: {
		type: Function,
		default: (value) => `${value} is an Invalid value`,
	},
	required: {
		type: Boolean,
	},
})

const values = defineModel()

const emails = ref([])
const search = ref(null)
const error = ref(null)
const query = ref('')
const text = ref('')
const showOptions = ref(false)

const selectedValue = computed({
	get: () => query.value || '',
	set: (val) => {
		query.value = ''
		if (val) {
			showOptions.value = false
		}
		val?.value && addValue(val.value)
	},
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

const filterOptions = createResource({
	url: 'frappe.desk.search.search_link',
	method: 'POST',
	cache: [text.value, props.doctype],
	auto: true,
	params: {
		txt: text.value,
		doctype: props.doctype,
	},
})

const options = computed(() => {
	return filterOptions.data || []
})

function reload(val) {
	filterOptions.update({
		params: {
			txt: val,
			doctype: props.doctype,
		},
	})
	filterOptions.reload()
}

const addValue = (value) => {
	error.value = null
	if (value) {
		const splitValues = value.split(',')
		splitValues.forEach((value) => {
			value = value.trim()
			if (value) {
				// check if value is not already in the values array
				if (!values.value?.includes(value)) {
					// check if value is valid
					if (value && props.validate && !props.validate(value)) {
						error.value = props.errorMessage(value)
						return
					}
					// add value to values array
					if (!values.value) {
						values.value = [value]
					} else {
						values.value.push(value)
					}
					value = value.replace(value, '')
				}
			}
		})
		!error.value && (value = '')
	}
}

const removeValue = (value) => {
	values.value = values.value.filter((v) => v !== value)
}

const removeLastValue = () => {
	if (query.value) return

	let emailRef = emails.value[emails.value.length - 1]?.$el
	if (document.activeElement === emailRef) {
		values.value.pop()
		nextTick(() => {
			if (values.value.length) {
				emailRef = emails.value[emails.value.length - 1].$el
				emailRef?.focus()
			} else {
				setFocus()
			}
		})
	} else {
		emailRef?.focus()
	}
}

function setFocus() {
	search.value.$el.focus()
}

defineExpose({ setFocus })

const labelClasses = computed(() => {
	return [
		{
			sm: 'text-xs',
			md: 'text-base',
		}[props.size || 'sm'],
		'text-ink-gray-5',
	]
})
</script>
