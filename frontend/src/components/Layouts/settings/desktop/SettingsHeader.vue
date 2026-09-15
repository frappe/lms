<template>
	<header class="shrink-0 p-8 pb-0">
		<div class="flex items-start justify-between gap-4">
			<div class="flex min-w-0 flex-col gap-1">
				<div
					v-if="
						title ||
						$slots['title-badge'] ||
						saveState !== undefined ||
						unsaved !== undefined
					"
					class="flex min-h-5 items-center gap-2"
				>
					<Button
						v-if="showBack"
						variant="ghost"
						size="md"
						icon-left="lucide-chevron-left"
						:label="title"
						class="-ms-3.5 !max-w-96 !justify-start !pe-0 text-p-lg-semibold cursor-pointer hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent active:text-ink-gray-5"
						@click="emit('back')"
					/>
					<h2 v-else-if="title" class="text-p-lg-semibold text-ink-gray-8">
						{{ title }}
					</h2>
					<slot name="title-badge" />
					<div
						v-if="saveState !== undefined || unsaved !== undefined"
						role="status"
						class="flex items-center"
					>
						<Badge
							v-if="marker"
							variant="subtle"
							:theme="marker.theme"
							:label="__(marker.label)"
						/>
					</div>
				</div>
				<p v-if="description" class="text-p-sm text-ink-gray-6 max-w-2xl">
					{{ description }}
				</p>
			</div>
			<div
				v-if="$slots.actions || enabled !== undefined"
				class="flex min-h-5 shrink-0 items-center gap-3"
			>
				<Switch
					v-if="enabled !== undefined"
					v-model="enabled"
					size="sm"
					:label="enabledLabel || __('Enabled')"
				/>
				<slot name="actions" />
			</div>
		</div>

		<div v-if="$slots.below" class="mt-4">
			<slot name="below" />
		</div>
	</header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Switch } from 'frappe-ui'
import type { BadgeProps } from 'frappe-ui'
import type { AutosaveStatus } from '@/composables/useAutosave'

// The header of every settings panel, in two variants: "back" is the title
// itself as a control (CRM's EditEmailTemplate), used by sub-pages; "plain"
// is an optional title/description plus `#actions`, used by top-level
// panels. A title is optional in both, and skipped when a panel's own
// section headings would repeat it, unless a title-badge is slotted in.
const props = defineProps<{
	title?: string
	description?: string
	/** Draws the title as a back control rather than a heading. */
	showBack?: boolean
	/** Marks the record as edited but not yet written. */
	unsaved?: boolean
	/** Set by a panel that writes on commit instead of on a Save button. */
	saveState?: AutosaveStatus
	/**
	 * Names the header switch when the record's state is not "enabled": a
	 * payment is Received, not Enabled. Defaults to Enabled.
	 */
	enabledLabel?: string
}>()

const emit = defineEmits<{ back: [] }>()

// A record's own on/off state belongs beside the actions, not as the first
// field in the body. Undefined on panels with no such state, which hides it.
const enabled = defineModel<boolean | undefined>('enabled', {
	default: undefined,
})

// One status marker for both autosave and Save-button panels, drawn as a
// frappe-ui Badge (CRM and Helpdesk pattern). `error` gets its own colour
// since the write path raises no toast, so this badge is the only place a
// failed write is ever reported.
//
// Sits beside the title, not in the actions cluster: between Enabled and
// Save it read as a third control. `idle` returns null but the wrapper
// stays, since it's the live region and must be in the DOM before content
// changes for a screen reader to announce them; `min-h-5` holds its height
// so a marker doesn't shift the body on every toggle.
const marker = computed<{ label: string; theme: BadgeProps['theme'] } | null>(
	() => {
		switch (props.saveState) {
			case 'saving':
				return { label: 'Saving…', theme: 'gray' }
			case 'saved':
				return { label: 'Saved', theme: 'green' }
			case 'error':
				return { label: 'Save failed', theme: 'red' }
			case 'dirty':
			case 'pending':
				return { label: 'Not saved', theme: 'amber' }
		}
		return props.unsaved ? { label: 'Not saved', theme: 'amber' } : null
	}
)
</script>
