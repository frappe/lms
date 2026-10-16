<template>
	<div class="relative flex h-full min-h-0 flex-col">
		<div
			:class="
				banded
					? ['shrink-0', flush && 'pb-4']
					: 'pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end'
			"
		>
			<slot name="header">
				<SettingsHeader
					v-model:enabled="enabled"
					:title="title"
					:description="description"
					:show-back="showBack"
					:unsaved="unsaved"
					:save-state="saveState"
					:enabled-label="enabledLabel"
					@back="emit('back')"
				>
					<template v-if="$slots['title-badge']" #title-badge>
						<slot name="title-badge" />
					</template>
					<template v-if="$slots['header-actions'] || saveLabel" #actions>
						<slot name="header-actions" />
						<Button
							v-if="saveLabel"
							:data-testid="saveTestid"
							variant="solid"
							:label="saveLabel"
							:loading="saving"
							:disabled="!canSave"
							@click="emit('save')"
						/>
					</template>
					<template v-if="$slots['header-bottom']" #below>
						<slot name="header-bottom" />
					</template>
				</SettingsHeader>
			</slot>
		</div>

		<div
			class="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-8"
			:class="flush ? '' : banded ? 'pt-4' : 'pt-8'"
		>
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { Button } from 'frappe-ui'
import SettingsHeader from '@/components/Layouts/settings/desktop/SettingsHeader.vue'
import type { AutosaveStatus } from '@/composables/useAutosave'

// The frame, and only the frame: a header band and a scrolling body beneath
// it. What a title is, and how a save reports itself, belong to
// SettingsHeader; this passes them through so the twenty-odd panels that
// want the ordinary header don't each assemble one.
//
// A panel that needs something else entirely overrides `#header` and keeps
// the frame.
const props = defineProps<{
	title?: string
	description?: string
	showBack?: boolean
	unsaved?: boolean
	saveState?: AutosaveStatus
	/** Names the header switch when the record's state is not "enabled". */
	enabledLabel?: string
	/**
	 * Takes the top padding off the body into the header band, so a list's
	 * rows begin at the body's own top edge (a list caps its rows region and
	 * scrolls there instead, see SettingsList). `pb-8` stays out here: the
	 * region is border-box, so bottom padding on it would eat into the rows.
	 */
	flush?: boolean
	/**
	 * Draws Save in the header, labelled with this. Every record form had the
	 * same Button written out in `#header-actions`, differing only in its
	 * word, so the frame draws it instead.
	 *
	 * Undefined draws nothing, which is how a page hides Save outright (a
	 * member form refused to a non-moderator). `#header-actions` still works,
	 * and comes before Save when both are used.
	 */
	saveLabel?: string
	/** Puts Save in its loading state while the write is in flight. */
	saving?: boolean
	/** Whether there is anything to save. Save is disabled without it. */
	canSave?: boolean
	saveTestid?: string
}>()

const slots = useSlots()

// Whether the header takes a band of its own above the body. A panel whose
// sections each carry their own heading gives the header nothing but the
// save marker, so it floats in the top corner instead and the body takes
// the full padding. A title, description, back control, enabled switch or
// slotted action keeps the band.
//
// The float is pushed to the end: the body's first line on such a panel is
// a section heading at the start edge, and a marker there would land on it.
const banded = computed(
	() =>
		Boolean(props.title || props.description || props.showBack) ||
		enabled.value !== undefined ||
		Boolean(props.saveLabel) ||
		Boolean(
			slots['title-badge'] || slots['header-actions'] || slots['header-bottom']
		)
)

const emit = defineEmits<{ back: []; save: [] }>()

const enabled = defineModel<boolean | undefined>('enabled', {
	default: undefined,
})
</script>
