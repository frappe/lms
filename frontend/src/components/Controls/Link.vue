<template>
	<div :class="attrs.class as any" :style="attrs.style as any">
		<Combobox
			:open="isOpen"
			:modelValue="value"
			:options="resolvedOptions"
			:placeholder="(attrs.placeholder as string) || __('Select option')"
			:disabled="attrs.readonly as boolean"
			:size="(attrs.size as ComboboxSize) || 'sm'"
			:aria-label="label ? undefined : (attrs['aria-label'] as string)"
			:autocomplete="attrs.autocomplete as string"
			:variant="attrs.variant as ComboboxVariant"
			:trigger="isButton ? 'button' : 'input'"
			:align="props.align"
			:loading="options.loading"
			:filterable="false"
			:label="label ? __(label) : undefined"
			:required="required"
			:description="description"
			:error="error"
			:query="query"
			@update:modelValue="onSelect"
			@update:query="onQuery"
			@update:open="onOpen"
			:class="isButton ? 'w-fit' : 'w-full'"
		>
			<template v-if="icon" #prefix>
				<span :class="[icon, 'size-4 shrink-0']" aria-hidden="true" />
			</template>
			<!-- Combobox draws the selected value through the list's row slot too;
			     the icon belongs on the control only, so rows hide it. -->
			<template v-if="icon" #item-prefix="{ selected }">
				<span
					v-if="selected"
					:class="[
						icon,
						'hidden size-4 shrink-0 [[data-slot=trigger]_&]:block',
					]"
					aria-hidden="true"
				/>
			</template>
			<template #footer>
				<div
					data-popover-footer-sticky
					class="-m-1 border-t border-outline-gray-2 bg-surface-elevation-2 p-2 mt-1"
				>
					<div v-if="creating" class="flex items-center gap-1">
						<button
							class="p-1 rounded-4 hover:bg-surface-gray-3 text-ink-gray-5"
							:aria-label="__('Cancel')"
							@click="creating = false"
						>
							<span class="lucide-arrow-left size-4 rtl:rotate-180" />
						</button>
						<FormControl
							v-model="newItemName"
							class="flex-1 min-w-0"
							size="sm"
							:placeholder="__(props.inlineCreatePlaceholder)"
							@keyup.enter="submitCreate"
						/>
						<Button
							variant="solid"
							size="sm"
							:disabled="!newItemName.trim()"
							:aria-label="__('Create')"
							@click="submitCreate"
						>
							{{ __('Create') }}
						</Button>
					</div>
					<div v-else class="flex flex-wrap justify-between gap-2">
						<Button
							variant="ghost"
							size="sm"
							:aria-label="__('Clear')"
							@click="clearValue"
						>
							{{ __('Clear') }}
						</Button>
						<Button
							v-if="props.onCreate"
							variant="ghost"
							size="sm"
							:aria-label="__('Create New')"
							@click="handleCreate"
						>
							<template #prefix>
								<span class="lucide-plus size-4" />
							</template>
							{{ __('Create New') }}
						</Button>
					</div>
				</div>
			</template>
		</Combobox>
	</div>
</template>

<script setup lang="ts">
import { Combobox, Button, FormControl, createResource } from 'frappe-ui'
import type { ComboboxOptionValue } from 'frappe-ui'
import { useDebounceFn, watchDebounced } from '@vueuse/core'
import { useAttrs, computed, ref, watch } from 'vue'
import { useSettings } from '@/stores/settings'
import type { Resource } from '@/types'

type ComboboxSize = 'xs' | 'sm' | 'md' | 'lg'
type ComboboxVariant = 'subtle' | 'outline' | 'ghost'

interface LinkOption {
	label: string
	value: string
	description?: string
}

type CreateHandler = (value: string | null, close?: () => void) => void

const props = withDefaults(
	defineProps<{
		doctype: string
		filters?: Record<string, unknown>
		/** A whitelisted search_link `query`, for doctypes the user cannot read. */
		query?: string
		modelValue?: string
		label?: string
		description?: string
		error?: string
		required?: boolean
		inlineCreate?: boolean
		inlineCreatePlaceholder?: string
		onCreate?: CreateHandler
		/** A lucide class drawn inside the control, before the value or placeholder. */
		icon?: string
		// Where the popover hangs off the control. `end` is the trailing edge in
		// either direction, so a control near the end of a row opens inwards.
		align?: 'start' | 'center' | 'end'
		/**
		 * search_link puts the record name in `label`, title_field in
		 * `description`. Swaps which shows bold, for this caller only.
		 */
		titleFirst?: boolean
	}>(),
	{ inlineCreatePlaceholder: 'Enter...', align: 'start' }
)

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
	(e: 'change', value: string): void
}>()

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
// A button trigger sizes to its value and moves the search into the menu.
const isButton = computed(() => attrs.trigger === 'button')
const valuePropPassed = computed<boolean>(() => 'value' in attrs)

const creating = ref<boolean>(false)
const newItemName = ref<string>('')
const isOpen = ref<boolean>(false)
// Owned here so the search starts empty on every open instead of keeping the
// picked label, which would filter the list down to the current value.
const query = ref<string>('')
let searchedFor: string | null = null

const value = computed<string>(() =>
	valuePropPassed.value ? (attrs.value as string) : props.modelValue
)

const searchTransform = (data: LinkOption[]): LinkOption[] =>
	data.map((o) => {
		const label = o.label || o.value
		// Drop the description when it just repeats the label.
		const hasDescription = o.description && o.description !== label
		if (!hasDescription) return { label, value: o.value }
		return props.titleFirst
			? { label: o.description as string, value: o.value, description: label }
			: { label, value: o.value, description: o.description }
	})

const options = createResource({
	url: 'frappe.desk.search.search_link',
	method: 'POST',
	auto: false,
	transform: searchTransform,
}) as Resource<LinkOption[] | null>

// A preselected value arrives as a raw docname. Resolve its title (the link's
// label) so the control shows e.g. the course title instead of "abce1234".
const currentLabel = ref<string>('')
let resolvedFor = ''

const titleResource = createResource({
	url: 'frappe.desk.search.search_link',
	method: 'POST',
	auto: false,
	transform: searchTransform,
	onSuccess(data: LinkOption[]) {
		const match = (data || []).find((o) => o.value === resolvedFor)
		if (match) currentLabel.value = match.label
	},
}) as Resource<LinkOption[] | null>

watch(
	value,
	(v) => {
		if (!v) {
			currentLabel.value = ''
			resolvedFor = ''
			return
		}
		// Skip if the value is already known (just picked, or already resolved).
		if (v === resolvedFor || options.data?.some((o) => o.value === v)) return
		resolvedFor = v
		titleResource.update({
			params: {
				txt: v,
				doctype: props.doctype,
				query: props.query,
				filters: JSON.stringify(props.filters),
			},
		})
		titleResource.reload()
	},
	{ immediate: true }
)

const resolvedOptions = computed<LinkOption[]>(() => {
	const list = options.data || []
	const current = value.value
	if (current && !list.some((o) => o.value === current)) {
		return [{ label: currentLabel.value || current, value: current }, ...list]
	}
	return list
})

function reload(txt: string = ''): void {
	searchedFor = txt
	options.update({
		params: {
			txt,
			doctype: props.doctype,
			query: props.query,
			filters: JSON.stringify(props.filters),
		},
	})
	options.reload()
}

function onOpen(open: unknown): void {
	isOpen.value = open as boolean
	if (!isOpen.value) return
	// In input mode the query is the selected label shown in the control.
	if (isButton.value) query.value = ''
	if (searchedFor !== '') reload('')
}

// Only typing searches; Combobox also writes the picked label into the query.
const search = useDebounceFn((txt: string) => {
	if (isOpen.value && txt !== searchedFor) reload(txt)
}, 300)

function onQuery(txt: unknown): void {
	query.value = txt as string
	search(query.value)
}

// Settings drawer (UserDropdown) is where users add Categories, Course
// Evaluators, etc. Refresh options once it closes so newly-created
// linked records show up without a full reload.
const settingsStore = useSettings()
watchDebounced(
	() => settingsStore.isSettingsOpen,
	(isOpen, wasOpen) => {
		if (wasOpen && !isOpen && searchedFor !== null) reload('')
	},
	{ debounce: 200 }
)

function onSelect(val: unknown): void {
	const selected = val as ComboboxOptionValue | null
	emit(
		valuePropPassed.value ? 'change' : 'update:modelValue',
		selected == null ? '' : String(selected)
	)
}

function clearValue(): void {
	emit(valuePropPassed.value ? 'change' : 'update:modelValue', '')
}

function handleCreate(): void {
	if (props.inlineCreate) {
		creating.value = true
		return
	}
	// Close the dropdown so it doesn't stack on top of the modal onCreate opens.
	isOpen.value = false
	props.onCreate?.(null)
}

function submitCreate(): void {
	const name = newItemName.value.trim()
	if (!name || !props.onCreate) return
	props.onCreate(name, () => {
		creating.value = false
		newItemName.value = ''
		reload('')
	})
}

defineExpose({ reload })
</script>
