<template>
	<div class="space-y-1.5">
		<FormLabel v-if="label" :label="label" :required="required" />
		<MultiSelect
			v-model="value"
			v-model:open="popoverOpen"
			:options="mergedOptions"
			:placeholder="placeholder"
			:emptyText="emptyText"
			:variant="variant"
			@update:open="onOpen"
			@update:query="onQuery"
			@update:modelValue="onChange"
		>
			<template #trigger="{ open, toggleOpen, selectedOptions, displayValue }">
				<button
					type="button"
					:class="[
						triggerBaseClasses,
						triggerVariantClasses[variant],
						'min-h-7 rounded px-2 w-full justify-between text-base',
					]"
					:data-state="open ? 'open' : 'closed'"
					@click="toggleOpen"
				>
					<span class="flex min-w-0 flex-1 items-center gap-2">
						<slot name="prefix" :selected="selectedOptions" />
						<span
							class="min-w-0 flex-1 truncate text-left"
							:class="!selectedOptions.length && 'text-ink-gray-4'"
						>
							<slot
								name="summary"
								:summary="displayValue || placeholder"
								:selected="selectedOptions"
							>
								<template v-if="selectedOptions.length">{{
									defaultSummary(selectedOptions)
								}}</template>
								<template v-else>{{ placeholder }}</template>
							</slot>
						</span>
					</span>
					<span
						class="lucide-chevron-down size-4 shrink-0 text-ink-gray-4 transition-transform duration-200"
						:class="open && 'rotate-180'"
					/>
				</button>
			</template>
			<template v-if="$slots['item-prefix']" #item-prefix="slotProps">
				<slot name="item-prefix" v-bind="slotProps" />
			</template>
			<template v-if="$slots['item-label']" #item-label="slotProps">
				<slot name="item-label" v-bind="slotProps" />
			</template>
			<template #footer="{ clearAll }">
				<slot name="footer" :close="closePopover">
					<div
						class="flex items-center justify-between gap-2 border-t border-outline-gray-1 px-2 py-1.5 mt-1"
					>
						<Button
							variant="ghost"
							size="sm"
							:aria-label="__('Clear')"
							@click="clearAll"
						>
							{{ __('Clear') }}
						</Button>
						<Button
							v-if="props.onCreate"
							variant="ghost"
							size="sm"
							:aria-label="__(createLabel)"
							@click="handleCreate"
						>
							<template #prefix>
								<span class="lucide-plus size-4" />
							</template>
							{{ __(createLabel) }}
						</Button>
					</div>
				</slot>
			</template>
		</MultiSelect>
	</div>
</template>

<script setup lang="ts">
import { Button, FormLabel, MultiSelect, createResource } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { Resource } from '@/types/api'

interface SelectOption {
	label: string
	value: string
	description?: string
	[key: string]: unknown
}

type CloseFn = () => void

const props = withDefaults(
	defineProps<{
		doctype: string
		filters?: Record<string, unknown>
		url?: string
		searchParams?: Record<string, unknown>
		transform?: (rows: Record<string, unknown>[]) => SelectOption[]
		extraOptions?: SelectOption[]
		label?: string
		placeholder?: string
		required?: boolean
		variant?: 'subtle' | 'outline' | 'ghost'
		onCreate?: (close: CloseFn) => void
		createLabel?: string
		emptyText?: string
	}>(),
	{
		filters: () => ({}),
		url: 'frappe.desk.search.search_link',
		searchParams: () => ({}),
		extraOptions: () => [],
		variant: 'subtle',
		createLabel: 'Create New',
		emptyText: 'No results',
	}
)

const value = defineModel<string[]>({ default: () => [] })

const popoverOpen = ref<boolean>(false)
let loaded = false

const triggerBaseClasses =
	'relative inline-flex items-center gap-2 text-left text-ink-gray-7 outline-none transition-[background-color,border-color,box-shadow] duration-150'

const triggerVariantClasses: Record<
	NonNullable<typeof props.variant>,
	string
> = {
	subtle:
		'border border-[--surface-gray-2] bg-surface-gray-2 hover:border-outline-elevation-2 hover:bg-surface-gray-3 focus-visible:bg-surface-base focus-visible:border-outline-gray-4 focus-visible:shadow-sm data-[state=open]:bg-surface-base data-[state=open]:border-outline-gray-4 data-[state=open]:shadow-sm',
	outline:
		'border border-outline-gray-2 bg-surface-base hover:border-outline-gray-3 hover:shadow-sm focus-visible:border-outline-gray-4 focus-visible:shadow-sm data-[state=open]:border-outline-gray-4 data-[state=open]:shadow-sm',
	ghost:
		'border border-transparent bg-transparent hover:bg-surface-gray-3 focus-within:bg-surface-gray-3',
}

function buildParams(txt: string) {
	return {
		txt,
		doctype: props.doctype,
		filters: JSON.stringify(props.filters),
		...props.searchParams,
	}
}

const options = createResource({
	url: props.url,
	method: 'POST',
	auto: false,
	transform: (data: Record<string, unknown>[]): SelectOption[] => {
		if (props.transform) return props.transform(data)
		return data.map((o) => ({
			label:
				(o.label as string) || (o.value as string) || (o.name as string) || '',
			value: (o.value as string) || (o.name as string) || '',
			description: (o.description as string) || undefined,
		}))
	},
}) as Resource<SelectOption[] | null>

function reload(txt: string = '') {
	loaded = true
	options.update({ params: buildParams(txt) })
	options.reload()
}

function onOpen(open: boolean) {
	if (open && !loaded) reload()
}

const onQuery = useDebounceFn((txt: string) => reload(txt || ''), 300)

const emit = defineEmits<{
	(e: 'change', value: string[]): void
}>()

function onChange(val: string[]) {
	emit('change', val)
}

function closePopover() {
	popoverOpen.value = false
}

function handleCreate() {
	props.onCreate?.(closePopover)
}

const mergedOptions = computed<SelectOption[]>(() => {
	const seen = new Set<string>()
	const out: SelectOption[] = []
	for (const o of options.data || []) {
		if (seen.has(o.value)) continue
		seen.add(o.value)
		out.push(o)
	}
	for (const o of props.extraOptions) {
		if (seen.has(o.value)) continue
		seen.add(o.value)
		out.push(o)
	}
	return out
})

const optionByValue = computed<Map<string, SelectOption>>(() => {
	const map = new Map<string, SelectOption>()
	mergedOptions.value.forEach((o) => map.set(o.value, o))
	return map
})

function defaultSummary(selected: { label: string }[]) {
	return selected.map((o) => o.label).join(', ')
}

defineExpose({ reload, options, optionByValue })
</script>
