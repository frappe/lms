<template>
	<MultiSelect
		v-model="value"
		v-model:open="popoverOpen"
		:options="mergedOptions"
		:placeholder="placeholder"
		:emptyText="emptyText"
		:variant="variant"
		:label="label ? __(label) : undefined"
		:description="description"
		:error="error"
		:required="required"
		@update:open="onOpen"
		@update:query="onQuery"
		@update:modelValue="onChange"
	>
		<template #trigger="{ open, setOpen, selectedOptions }">
			<button
				type="button"
				:class="[
					triggerBaseClasses,
					triggerVariantClasses[variant],
					'min-h-7 rounded px-2 w-full justify-between text-base',
					disabled && 'cursor-not-allowed opacity-60',
				]"
				:data-state="open ? 'open' : 'closed'"
				:disabled="disabled"
				@click="setOpen(!open)"
			>
				<span class="flex min-w-0 flex-1 items-center gap-2">
					<slot name="prefix" :selected="selectedOptions" />
					<span
						class="min-w-0 flex-1 truncate text-start"
						:class="!selectedOptions.length && 'text-ink-gray-4'"
					>
						<slot
							name="summary"
							:summary="triggerLabel(selectedOptions) || placeholder"
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
		<template #footer="{ clear }">
			<slot name="footer" :close="closePopover">
				<div
					class="flex items-center justify-between gap-2 border-t border-outline-gray-1 px-2 py-1.5 mt-1"
				>
					<Button
						variant="ghost"
						size="sm"
						:aria-label="__('Clear')"
						@click="clear"
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
</template>

<script setup lang="ts">
import { Button, MultiSelect, createResource } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { Resource } from '@/types'

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
		description?: string
		error?: string
		placeholder?: string
		required?: boolean
		disabled?: boolean
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
	'relative inline-flex items-center gap-2 text-start text-ink-gray-7 outline-none transition-[background-color,border-color,box-shadow] duration-150'

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

function toOptions(data: Record<string, unknown>[]): SelectOption[] {
	if (props.transform) return props.transform(data)
	return data.map((o) => ({
		label:
			(o.label as string) || (o.value as string) || (o.name as string) || '',
		value: (o.value as string) || (o.name as string) || '',
		description: (o.description as string) || undefined,
	}))
}

const options = createResource({
	url: props.url,
	method: 'POST',
	auto: false,
	transform: toOptions,
}) as Resource<SelectOption[] | null>

function reload(txt: string = '') {
	loaded = true
	options.update({ params: buildParams(txt) })
	options.reload()
}

function onOpen(open: boolean) {
	if (open && !loaded) reload()
}

const onQuery = useDebounceFn(
	(txt: unknown) => reload((txt as string) || ''),
	300
)

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

// Saved values need labels before the dropdown is ever opened: the search
// endpoint only returns query hits, so resolve them by name up front.
const resolved = ref<Map<string, SelectOption>>(new Map())

// Values this control has asked the endpoint to resolve. Anything else in the
// response is a search hit, not a resolution, and must not be treated as one.
const requested = new Set<string>()

const titleLookup = createResource({
	url: props.url,
	method: 'POST',
	auto: false,
	transform: toOptions,
	onSuccess: (rows: SelectOption[]) => {
		const next = new Map(resolved.value)
		for (const o of rows) {
			if (o.value && requested.has(o.value)) next.set(o.value, o)
		}
		resolved.value = next
	},
}) as Resource<SelectOption[] | null>

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
	for (const o of resolved.value.values()) {
		if (seen.has(o.value)) continue
		seen.add(o.value)
		out.push(o)
	}
	// Last resort so a selection is never invisible: show the raw docname
	// for values the endpoint could not resolve.
	if (!titleLookup.loading) {
		for (const v of value.value) {
			if (seen.has(v)) continue
			seen.add(v)
			out.push({ label: v, value: v })
		}
	}
	return out
})

function resolveMissing(vals: string[]): void {
	const known = new Set<string>([
		...(options.data || []).map((o) => o.value),
		...props.extraOptions.map((o) => o.value),
		...resolved.value.keys(),
	])
	// Only fire for names we have never asked about; a name that was requested
	// but never came back (deleted/inaccessible doc) must not re-trigger a lookup
	// on every value change.
	const fresh = (vals || []).filter(
		(v) => v && !known.has(v) && !requested.has(v)
	)
	if (!fresh.length) return
	fresh.forEach((v) => requested.add(v))
	// Resolve everything still outstanding, not just the fresh names, so a
	// superseded in-flight request never drops names asked for earlier.
	const outstanding = [...requested].filter((v) => !resolved.value.has(v))
	titleLookup.update({
		params: {
			...buildParams(''),
			// Search endpoints spell "give me these exact docnames" differently and
			// Frappe drops kwargs a method does not declare, so send both spellings:
			// `filters` is honoured by frappe.desk.search.search_link, `names` by
			// lms.lms.api.search_users_by_role. Sending only `filters` degenerates
			// into an empty-txt search on the latter, which returns arbitrary rows.
			//
			// Resolution pins exact docnames, so props.filters is deliberately NOT
			// spread in: a caller filter like `published: 1` would wrongly drop a
			// selected value that no longer matches, leaving it labelled by docname.
			filters: JSON.stringify({ name: ['in', outstanding] }),
			names: JSON.stringify(outstanding),
			page_length: outstanding.length,
		},
	})
	titleLookup.reload()
}

watch(value, (vals) => resolveMissing(vals || []), { immediate: true })

const optionByValue = computed<Map<string, SelectOption>>(() => {
	const map = new Map<string, SelectOption>()
	mergedOptions.value.forEach((o) => map.set(o.value, o))
	return map
})

function defaultSummary(selected: { label: string }[]) {
	return selected.map((o) => o.label).join(', ')
}

const triggerLabel = (options: { label: string }[]) =>
	options.map((option) => option.label).join(', ')

defineExpose({ reload, options, optionByValue })
</script>
