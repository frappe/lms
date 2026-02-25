<template>
	<div>
		<!-- Label -->
		<div v-if="label" class="text-xs text-ink-gray-5 mb-1">
			{{ __(label) }}
			<span class="text-ink-red-3" v-if="attrs.required">*</span>
		</div>
		<Combobox v-model="selectedValue" nullable v-slot="{ open }">
			<div class="relative w-full">
				<ComboboxInput
					class="form-input w-full"
					:class="inputClasses"
					type="text"
					:value="selectedValue"
					autocomplete="off"
					@click="onFocus"
				/>
				<ComboboxButton ref="trigger" class="hidden" />

				<!-- Dropdown -->
				<ComboboxOptions
					class="absolute z-20 mt-1 w-full rounded-lg bg-surface-modal py-1 text-base border-2 border-outline-gray-modals shadow-lg"
				>
					<input
						ref="search"
						v-model="query"
						class="form-input w-[98%] rounded-tl-lg rounded-tr-lg mb-1 mx-1"
						type="text"
						placeholder="Search"
						autocomplete="off"
					/>
					<!-- Options -->
					<div class="my-1 max-h-[12rem] overflow-y-auto px-1.5">
						<template v-for="group in groups" :key="group.key">
							<div
								v-if="group.group && !group.hideLabel"
								class="px-2.5 py-1.5 text-sm font-medium text-ink-gray-4"
							>
								{{ group.group }}
							</div>

							<ComboboxOption
								v-for="option in group.items"
								:key="option.value"
								:value="option.value"
								v-slot="{ active }"
							>
								<li
									:class="[
										'flex items-center rounded px-2.5 py-2 text-base cursor-pointer',
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

						<div
							v-if="groups.length === 0"
							class="mt-1.5 rounded-md px-2.5 py-1.5 text-base text-ink-gray-5"
						>
							{{ __('No results found') }}
						</div>
					</div>

					<!-- Footer -->
					<div
						v-if="slots.footer"
						class="border-t border-outline-gray-modals p-1.5 pb-0.5"
					>
						<slot
							name="footer"
							v-bind="{
								value: selectedValue,
								close,
							}"
						/>
					</div>
				</ComboboxOptions>
			</div>
		</Combobox>
	</div>
</template>

<script setup>
import {
	Combobox,
	ComboboxInput,
	ComboboxOptions,
	ComboboxOption,
	ComboboxButton,
} from '@headlessui/vue'
import { ref, computed, useAttrs, useSlots, watch, nextTick } from 'vue'
import { watchDebounced } from '@vueuse/core'

const props = defineProps({
	modelValue: {
		type: [String, Object],
		default: null,
	},
	options: {
		type: Array,
		default: () => [],
	},
	size: {
		type: String,
		default: 'md',
	},
	label: {
		type: String,
		default: '',
	},
	variant: {
		type: String,
		default: 'subtle',
	},
	placeholder: {
		type: String,
		default: '',
	},
	disabled: {
		type: Boolean,
		default: false,
	},
	filterable: {
		type: Boolean,
		default: true,
	},
})

const emit = defineEmits(['update:modelValue', 'update:query', 'change'])
const trigger = ref(null)
const search = ref(null)
const attrs = useAttrs()
const slots = useSlots()
const selectedValue = ref(props.modelValue)
const query = ref('')
const valuePropPassed = computed(() => 'value' in attrs)

watch(selectedValue, (val) => {
	query.value = ''
	emit(valuePropPassed.value ? 'change' : 'update:modelValue', val)
})

function clearValue() {
	emit('update:modelValue', null)
}

const groups = computed(() => {
	if (!props.options?.length) return []

	const normalized = props.options[0]?.group
		? props.options
		: [{ group: '', items: props.options }]
	return normalized
		.map((group, i) => ({
			key: i,
			group: group.group,
			hideLabel: group.hideLabel || false,
			items: props.filterable ? filterOptions(group.items) : group.items,
		}))
		.filter((group) => group.items.length > 0)
})

function filterOptions(options) {
	if (!query.value) return options
	const q = query.value.toLowerCase()
	return options.filter((option) =>
		[option.label, option.value]
			.filter(Boolean)
			.some((text) => text.toString().toLowerCase().includes(q))
	)
}

watchDebounced(
	query,
	(val) => {
		emit('update:query', val)
	},
	{ debounce: 300 }
)

const onFocus = () => {
	trigger.value?.$el.click()
	nextTick(() => {
		search.value?.focus()
	})
}

const close = () => {
	selectedValue.value = null
	trigger.value?.$el.click()
}

const textColor = computed(() =>
	props.disabled ? 'text-ink-gray-5' : 'text-ink-gray-8'
)

const inputClasses = computed(() => {
	const sizeClasses = {
		sm: 'text-base rounded h-7',
		md: 'text-base rounded h-8',
		lg: 'text-lg rounded-md h-10',
		xl: 'text-xl rounded-md h-10',
	}[props.size]

	const paddingClasses = {
		sm: 'py-1.5 px-2',
		md: 'py-1.5 px-2.5',
		lg: 'py-1.5 px-3',
		xl: 'py-1.5 px-3',
	}[props.size]

	const variant = props.disabled ? 'disabled' : props.variant

	const variantClasses = {
		subtle:
			'border border-outline-gray-modals bg-surface-gray-2 placeholder-ink-gray-4 hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3',
		outline:
			'border border-outline-gray-2 bg-surface-white placeholder-ink-gray-4 hover:border-outline-gray-3 hover:shadow-sm focus:bg-surface-white focus:border-outline-gray-4 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3',
		disabled: [
			'border bg-surface-menu-bar placeholder-ink-gray-3',
			props.variant === 'outline'
				? 'border-outline-gray-2'
				: 'border-transparent',
		],
	}[variant]

	return [
		sizeClasses,
		paddingClasses,
		variantClasses,
		textColor.value,
		'transition-colors w-full',
	]
})
</script>
