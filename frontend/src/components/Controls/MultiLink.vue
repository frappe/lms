<template>
	<MultiSelect
		v-model="value"
		v-model:open="popoverOpen"
		v-model:query="query"
		:options="mergedOptions"
		:placeholder="placeholder"
		:emptyText="emptyText"
		:variant="variant"
		:disabled="disabled"
		:loading="loading"
		:filterable="false"
		:label="label ? __(label) : undefined"
		:description="description"
		:error="error"
		:required="required"
		@update:open="onOpen"
		@update:modelValue="onChange"
	>
		<template v-if="$slots.prefix" #prefix="slotProps">
			<slot
				name="prefix"
				v-bind="slotProps"
				:selected="slotProps.selectedOptions"
			/>
		</template>
		<template v-if="$slots.summary" #summary="slotProps">
			<slot
				name="summary"
				v-bind="slotProps"
				:selected="slotProps.selectedOptions"
			/>
		</template>
		<template v-if="$slots['item-prefix']" #item-prefix="slotProps">
			<slot name="item-prefix" v-bind="slotProps" />
		</template>
		<template v-if="$slots['item-label']" #item-label="slotProps">
			<slot name="item-label" v-bind="slotProps" />
		</template>
		<template #footer="{ clear, selectAll }">
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
					<div
						v-if="props.onCreate || allowSelectAll"
						class="flex items-center gap-1"
					>
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
						<Button
							v-if="allowSelectAll"
							variant="ghost"
							size="sm"
							:aria-label="__('Select all')"
							@click="selectAll"
						>
							{{ __('Select all') }}
						</Button>
					</div>
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

// The trigger is MultiSelect's own: it already carries the theme's focus ring,
// the open/variant/size data attributes and the full aria wiring, none of which
// a local button reproduced correctly. So `#trigger` is not overridden here and
// `disabled` is handed to MultiSelect rather than to a button of ours.
//
// `#prefix` and `#summary` are forwarded only when a consumer supplies them.
// Forwarding `#summary` unconditionally would suppress MultiSelect's own
// summary, which collapses 2+ selections to "N selected", and with it the
// phantom sizer that keeps the trigger from widening with the selection.
// Both slots get MultiSelect's slot props plus `selected`, the name MultiLink's
// own trigger used, so a consumer written against the old shape still works.
//
// Footer layout: Clear on the start edge, everything additive on the end edge,
// so the one destructive action in the row is never adjacent to the ones that
// add. Select all sits last because it is the end-edge action asked for; a
// control that also passes `onCreate` puts Create New beside it rather than back
// on the start edge, so Clear stays alone whatever the combination.

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
		/** Offer a one-click select-all in the footer. Off unless asked for: on a
		 *  picker whose list is one page of a server search, selecting everything
		 *  is rarely what the reader means. What the button reaches is that page
		 *  `page_length` defaults to 10 server-side, not every record of the
		 *  doctype, which the label no longer says. */
		allowSelectAll?: boolean
	}>(),
	{
		filters: () => ({}),
		url: 'frappe.desk.search.search_link',
		searchParams: () => ({}),
		extraOptions: () => [],
		variant: 'subtle',
		createLabel: 'Create New',
		emptyText: 'No results',
		allowSelectAll: false,
	}
)

const value = defineModel<string[]>({ default: () => [] })

const popoverOpen = ref<boolean>(false)
// Bound rather than left to MultiSelect, because the search runs on the server:
// the typed text has to reach `reload()`. Binding also makes the query ours to
// reset. See onOpen().
const query = ref<string>('')
let loaded = false

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

// Surfaced to MultiSelect so the list reads as pending rather than empty. Left
// unset, the popover renders `emptyText` for the whole round trip, so every
// dropdown opens on "No results" and only then fills in.
const loading = computed<boolean>(() => !!options.loading)

function onOpen(open: boolean) {
	if (open) {
		if (!loaded) reload()
		return
	}
	// MultiSelect never clears a bound query, so a control reopened after a
	// fruitless search would still be showing that search's text over that
	// search's (empty) results. Clearing runs the base search again.
	query.value = ''
}

const runQuery = useDebounceFn((txt: string) => reload(txt), 300)

watch(query, (txt) => runQuery(txt))

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

// What this control is searching, as one comparable string. A Raven condition
// row swaps its value cell's doctype in place when the rule type changes, and
// Vue reuses this instance across that swap, so without this the picker would
// go on offering the previous doctype's records, and would never re-query,
// because `loaded` says it already has.
const searchKey = computed<string>(() =>
	JSON.stringify([props.url, props.doctype, props.filters, props.searchParams])
)

watch(searchKey, () => {
	loaded = false
	options.data = null
	resolved.value = new Map()
	requested.clear()
	resolveMissing(value.value || [])
	if (popoverOpen.value) reload(query.value)
})

const optionByValue = computed<Map<string, SelectOption>>(() => {
	const map = new Map<string, SelectOption>()
	mergedOptions.value.forEach((o) => map.set(o.value, o))
	return map
})

defineExpose({ reload, options, optionByValue })
</script>
