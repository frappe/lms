<template>
	<div>
		<FormLabel
			v-if="attrs.label"
			:label="attrs.label"
			:required="attrs.required"
			class="mb-1.5"
		/>
		<Combobox
			:modelValue="value"
			:options="resolvedOptions"
			:placeholder="attrs.placeholder as string"
			:disabled="attrs.readonly as boolean"
			:size="(attrs.size as ComboboxSize) || 'sm'"
			:variant="attrs.variant as ComboboxVariant"
			:loading="options.loading"
			@update:modelValue="onSelect"
			@update:query="onQuery"
			@update:open="onOpen"
			class="w-full focus-within:border-outline-gray-4 focus-within:bg-surface-base focus-within:shadow-sm focus-within:outline-none data-[state=open]:border-outline-gray-4 data-[state=open]:bg-surface-base data-[state=open]:shadow-sm data-[state=open]:outline-none"
		>
			<template #footer>
				<div
					data-popover-footer-sticky
					class="-m-1 border-t border-outline-gray-2 bg-surface-elevation-2 p-2 mt-1"
				>
					<div v-if="creating" class="flex items-center gap-1">
						<button
							class="p-1 rounded hover:bg-surface-gray-3 text-ink-gray-5"
							:aria-label="__('Cancel')"
							@click="creating = false"
						>
							<span class="lucide-arrow-left size-4" />
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
					<div v-else class="flex justify-between">
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
import {
	Combobox,
	Button,
	FormControl,
	FormLabel,
	createResource,
} from 'frappe-ui'
import { useDebounceFn, watchDebounced } from '@vueuse/core'
import { useAttrs, computed, ref, watch } from 'vue'
import { useSettings } from '@/stores/settings'
import type { Resource } from '@/types/api'

type ComboboxSize = 'sm' | 'md' | 'lg' | 'xl'
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
		modelValue?: string
		description?: string
		inlineCreate?: boolean
		inlineCreatePlaceholder?: string
		onCreate?: CreateHandler
	}>(),
	{ inlineCreatePlaceholder: 'Enter...' }
)

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
	(e: 'change', value: string): void
}>()

const attrs = useAttrs()
const valuePropPassed = computed<boolean>(() => 'value' in attrs)

const creating = ref<boolean>(false)
const newItemName = ref<string>('')
let loaded = false

const value = computed<string>(() =>
	valuePropPassed.value ? (attrs.value as string) : props.modelValue
)

const searchTransform = (data: LinkOption[]): LinkOption[] =>
	data.map((o) => {
		const label = o.label || o.value
		// Drop the description when it just repeats the label.
		const hasDescription = o.description && o.description !== label
		return hasDescription
			? { label, value: o.value, description: o.description }
			: { label, value: o.value }
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
	loaded = true
	options.update({
		params: {
			txt,
			doctype: props.doctype,
			filters: JSON.stringify(props.filters),
		},
	})
	options.reload()
}

function onOpen(open: boolean): void {
	if (open && !loaded) reload('')
}

const onQuery = useDebounceFn((txt: string) => reload(txt), 300)

// Settings drawer (UserDropdown) is where users add Categories, Course
// Evaluators, etc. — refresh options once it closes so newly-created
// linked records show up without a full reload.
const settingsStore = useSettings()
watchDebounced(
	() => settingsStore.isSettingsOpen,
	(isOpen, wasOpen) => {
		if (wasOpen && !isOpen && loaded) reload('')
	},
	{ debounce: 200 }
)

function onSelect(val: string | null): void {
	emit(valuePropPassed.value ? 'change' : 'update:modelValue', val ?? '')
}

function clearValue(): void {
	emit(valuePropPassed.value ? 'change' : 'update:modelValue', '')
}

function handleCreate(): void {
	if (props.inlineCreate) {
		creating.value = true
		return
	}
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
