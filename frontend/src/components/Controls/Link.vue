<template>
	<div class="space-y-1.5">
		<label class="block" :class="labelClasses" v-if="attrs.label">
			{{ attrs.label }}
			<span class="text-ink-red-3" v-if="attrs.required">*</span>
		</label>
		<Autocomplete
			ref="autocomplete"
			:options="options.data"
			v-model="value"
			:size="attrs.size || 'sm'"
			:variant="attrs.variant"
			:placeholder="attrs.placeholder"
			:readonly="attrs.readonly"
		>
			<template #target="{ open, togglePopover }">
				<slot name="target" v-bind="{ open, togglePopover }" />
			</template>

			<template #prefix>
				<slot name="prefix" />
			</template>

			<template #item-prefix="{ active, selected, option }">
				<slot name="item-prefix" v-bind="{ active, selected, option }" />
			</template>

			<template #item-label="{ active, selected, option }">
				<slot name="item-label" v-bind="{ active, selected, option }" />
			</template>

			<template #footer="{ value, close }">
				<div v-if="creating" class="flex items-center gap-1">
					<button
						class="p-1 rounded hover:bg-surface-gray-3 text-ink-gray-5"
						@click="creating = false"
						:aria-label="__('Cancel')"
					>
						<ArrowLeft class="size-4 stroke-1.5" />
					</button>
					<FormControl
						v-model="newItemName"
						class="flex-1 min-w-0"
						size="sm"
						:placeholder="__(props.inlineCreatePlaceholder)"
					/>
					<Button
						variant="solid"
						size="sm"
						:disabled="!newItemName.trim()"
						@click="submitCreate"
						:aria-label="__('Create')"
					>
						{{ __('Create') }}
					</Button>
				</div>
				<div v-else class="flex justify-between">
					<Button
						variant="ghost"
						@click="() => clearValue(close)"
						:aria-label="__('Clear')"
					>
						{{ __('Clear') }}
					</Button>
					<Button
						v-if="props.onCreate"
						variant="ghost"
						@click="handleCreate(close)"
						:aria-label="__('Create New')"
					>
						<template #prefix>
							<Plus class="size-4 stroke-1.5" />
						</template>
						{{ __('Create New') }}
					</Button>
				</div>
			</template>
		</Autocomplete>
		<p v-if="description" class="text-sm text-ink-gray-5">{{ description }}</p>
	</div>
</template>

<script setup>
import Autocomplete from '@/components/Controls/Autocomplete.vue'
import { watchDebounced } from '@vueuse/core'
import { createResource, Button, FormControl } from 'frappe-ui'
import { Plus, ArrowLeft } from 'lucide-vue-next'
import { useAttrs, computed, ref } from 'vue'
import { useSettings } from '@/stores/settings'

const props = defineProps({
	doctype: {
		type: String,
		required: true,
	},
	filters: {
		type: Object,
		default: () => ({}),
	},
	modelValue: {
		type: String,
		default: '',
	},
	description: {
		type: String,
		default: '',
	},
	inlineCreate: {
		type: Boolean,
		default: false,
	},
	inlineCreatePlaceholder: {
		type: String,
		default: 'Enter...',
	},
	onCreate: {
		type: Function,
		default: null,
	},
})

const emit = defineEmits(['update:modelValue', 'change'])
const attrs = useAttrs()
const valuePropPassed = computed(() => 'value' in attrs)
const creating = ref(false)
const newItemName = ref('')

const value = computed({
	get: () => (valuePropPassed.value ? attrs.value : props.modelValue),
	set: (val) => {
		return (
			val?.value &&
			emit(valuePropPassed.value ? 'change' : 'update:modelValue', val.value)
		)
	},
})

const autocomplete = ref(null)
const text = ref('')
const settingsStore = useSettings()

function handleCreate(close) {
	if (props.inlineCreate) {
		creating.value = true
		return
	}
	if (props.onCreate) {
		props.onCreate(null, close)
	}
}

function submitCreate() {
	if (!newItemName.value.trim() || !props.onCreate) return
	const value = newItemName.value.trim()
	props.onCreate(value, () => {
		creating.value = false
		newItemName.value = ''
		reload()
	})
}

watchDebounced(
	() => autocomplete.value?.query,
	(val) => {
		val = val || ''
		if (text.value === val) return
		text.value = val
		reload(val)
	},
	{ debounce: 300, immediate: true }
)

watchDebounced(
	() => props.doctype,
	() => reload(''),
	{ debounce: 300, immediate: true }
)

watchDebounced(
	() => settingsStore.isSettingsOpen,
	(isOpen, wasOpen) => {
		if (wasOpen && !isOpen) {
			reload('')
		}
	},
	{ debounce: 200 }
)

const options = createResource({
	url: 'frappe.desk.search.search_link',
	cache: [props.doctype, text.value],
	method: 'POST',
	auto: true,
	params: {
		txt: text.value,
		doctype: props.doctype,
		filters: JSON.stringify(props.filters),
	},
	transform: (data) => {
		return data.map((option) => {
			return {
				label: option.label || option.value,
				value: option.value,
				description: option.description,
			}
		})
	},
})

const reload = (val = '') => {
	options.update({
		params: {
			txt: val,
			doctype: props.doctype,
			filters: JSON.stringify(props.filters),
		},
	})
	options.reload()
}

const clearValue = (close) => {
	emit(valuePropPassed.value ? 'change' : 'update:modelValue', '')
	close()
}

const labelClasses = computed(() => {
	return [
		{
			sm: 'text-xs',
			md: 'text-base',
		}[attrs.size || 'sm'],
		'text-ink-gray-5',
	]
})

defineExpose({ reload })
</script>
