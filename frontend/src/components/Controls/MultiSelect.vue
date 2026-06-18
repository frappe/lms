<template>
	<div class="space-y-1.5">
		<FormLabel v-if="label" :label="label" :required="required" />
		<Combobox v-model="selectedValue" nullable v-slot="{ open }">
			<div class="relative w-full">
				<div
					class="flex flex-wrap items-center gap-1.5 w-full rounded-lg border border-[--surface-gray-2] bg-surface-gray-2 px-2 py-1.5 cursor-text transition-colors hover:border-outline-elevation-2 hover:bg-surface-gray-3 focus-within:bg-surface-base focus-within:border-outline-gray-4 focus-within:shadow-sm focus-within:ring-0"
					@click="focusInput"
				>
					<button
						v-for="value in values"
						:key="value"
						type="button"
						class="inline-flex items-center gap-1 bg-surface-base border border-outline-gray-2 text-ink-gray-7 ps-2 pe-1.5 py-0.5 rounded text-base leading-5"
						@click.stop="removeValue(value)"
					>
						<span>{{ value }}</span>
						<span class="lucide-x size-3.5 shrink-0" />
					</button>
					<ComboboxInput
						ref="search"
						class="flex-1 min-w-[4rem] border-none outline-none bg-transparent p-0 text-base focus:ring-0"
						type="text"
						:placeholder="!values?.length ? __('Search...') : ''"
						@change="
							(e) => {
								query = e.target.value
							}
						"
						autocomplete="off"
						@focus="onFocus"
					/>
				</div>
				<ComboboxButton ref="trigger" class="hidden" />
				<ComboboxOptions
					v-show="open"
					static
					class="absolute z-20 mt-1 w-full rounded-lg bg-surface-elevation-2 border-2 border-outline-elevation-2 max-h-[13rem] flex flex-col"
				>
					<div
						class="flex-1 my-1 overflow-y-auto px-1.5"
						:class="options.length ? 'min-h-[6rem]' : 'min-h-[1rem]'"
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
										<div class="text-base-medium text-ink-gray-8">
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
						class="p-1 bg-surface-base border-t rounded-b-lg"
					>
						<Button
							variant="ghost"
							class="w-full !justify-start"
							:label="__('Create New')"
							@click="attrs.onCreate()"
						>
							<template #prefix>
								<span class="lucide-plus size-4" />
							</template>
						</Button>
					</div>
				</ComboboxOptions>
			</div>
		</Combobox>
	</div>
</template>

<script setup lang="ts">
import {
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOptions,
	ComboboxOption,
} from '@headlessui/vue'
import { createResource, Button, FormLabel, toast } from 'frappe-ui'
import { ref, computed, useAttrs, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import type { Resource } from '@/types/api'

interface SelectOption {
	label: string
	value: string
	description?: string
}

const props = withDefaults(
	defineProps<{
		label?: string
		size?: string
		doctype: string
		filters?: Record<string, unknown> | unknown[]
		url?: string
		searchParams?: Record<string, unknown>
		validate?: (value: string) => boolean
		errorMessage?: (value: string) => string
		required?: boolean
	}>(),
	{
		filters: () => ({}),
		url: 'frappe.desk.search.search_link',
		searchParams: () => ({}),
		errorMessage: (value: string) => `${value} is an Invalid value`,
	}
)

const values = defineModel<string[]>({ default: () => [] })
const attrs = useAttrs()
const trigger = ref<{ $el: HTMLElement } | null>(null)
const query = ref<string>('')
const text = ref<string>('')
const selectedValue = ref<SelectOption | null>(null)

watch(selectedValue, (val) => {
	if (!val?.value) return
	query.value = ''
	addValue(val.value)
	selectedValue.value = null
})

watchDebounced(
	query,
	(val) => {
		const v = val || ''
		if (text.value === v) return
		text.value = v
		reload(v)
	},
	{ debounce: 300, immediate: true }
)

watch(
	() => [props.filters, props.searchParams],
	() => {
		reload(text.value)
	},
	{ deep: true }
)

function getParams(txt: string) {
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
}) as Resource<SelectOption[] | null>

const options = computed<SelectOption[]>(() => {
	const allOptions = filterOptions.data || []
	return allOptions.filter((option) => !values.value?.includes(option.value))
})

function reload(val: string) {
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

function addValue(value: string) {
	if (!value) return

	const splitValues = value.split(',')
	const newValues = [...(values.value || [])]

	splitValues.forEach((raw) => {
		const val = raw.trim()
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

function removeValue(value: string) {
	values.value = (values.value || []).filter((v) => v !== value)
}
</script>
