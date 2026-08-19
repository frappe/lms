<template>
	<div :class="attrs.class as any" :style="attrs.style as any">
		<Combobox
			:open="isOpen"
			:modelValue="value"
			:options="resolvedOptions"
			:placeholder="attrs.placeholder as string"
			:disabled="attrs.readonly as boolean"
			:size="(attrs.size as ComboboxSize) || 'sm'"
			:aria-label="label ? undefined : (attrs['aria-label'] as string)"
			:variant="attrs.variant as ComboboxVariant"
			:loading="options.loading"
			:label="label ? __(label) : undefined"
			:required="required"
			:description="description"
			:error="error"
			@update:modelValue="onSelect"
			@update:query="onQuery"
			@update:open="onOpen"
			class="w-full"
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
		label?: string
		description?: string
		error?: string
		required?: boolean
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

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const valuePropPassed = computed<boolean>(() => 'value' in attrs)

const creating = ref<boolean>(false)
const newItemName = ref<string>('')
const isOpen = ref<boolean>(false)
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

function onOpen(open: unknown): void {
	isOpen.value = open as boolean
	if (isOpen.value && !loaded) reload('')
}

const onQuery = useDebounceFn((txt: unknown) => reload(txt as string), 300)

// Settings drawer (UserDropdown) is where users add Categories, Course
// Evaluators, etc. Refresh options once it closes so newly-created
// linked records show up without a full reload.
const settingsStore = useSettings()
watchDebounced(
	() => settingsStore.isSettingsOpen,
	(isOpen, wasOpen) => {
		if (wasOpen && !isOpen && loaded) reload('')
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

<style scoped>
/*
 * frappe-ui's Combobox trigger carries `focus-within:focus-ring` /
 * `data-[state=open]:focus-ring` UNCONDITIONALLY (triggerBaseClassesFocusWithin
 * in node_modules/frappe-ui/src/components/shared/selection/utils.ts:75-76;
 * Link never sets a button trigger or #trigger slot, so this always applies),
 * which paints an outline ring on focus/open. This project's field convention
 * is border+shadow with NO ring on fields. `focus-visible:ring` is reserved
 * for buttons/nav (see frappe-ui-beta7-field-focus-states). These rules exist
 * to CANCEL frappe-ui's ring and restore that field convention on the
 * trigger. They are NOT redundant with frappe-ui's own styling, so do not
 * delete them thinking they duplicate it.
 *
 * Written as a scoped :deep() selector on [data-slot="trigger"], not as a
 * plain `class` on <Combobox>, because Combobox routes a caller's `class` to
 * its LabelingWrapper (not the trigger) once a label is present. See
 * `hasLabeling` in node_modules/frappe-ui/src/components/Combobox/Combobox.vue.
 * Nearly every <Link> caller passes a label, so a plain class here would
 * silently stop reaching the trigger. Targeting the data-slot instead makes
 * it independent of that labeled/unlabeled routing.
 */
:deep([data-slot='trigger']:focus-within),
:deep([data-slot='trigger'][data-state='open']) {
	@apply border-outline-gray-4 bg-surface-base shadow-sm outline-none;
}
</style>
