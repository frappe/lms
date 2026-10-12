<template>
	<Dialog
		v-model="open"
		:title="__('Discard changes?')"
		:message="__('This form has unsaved changes. Leaving now discards them.')"
		size="sm"
		:actions="dialogActions"
	/>
</template>

<script setup lang="ts">
/**
 * The prompt the settings dirty guard awaits before discarding an edited
 * form. Reads open state from the guard's module-level prompt, not a prop,
 * since the guard raises it from `router.beforeEach`, with no component to ask.
 */
import { Dialog } from 'frappe-ui'
import { computed, watch } from 'vue'
import { answerDiscard, discardPrompt } from '@/composables/useDirtyGuard'

interface DialogAction {
	label: string
	variant?: 'solid'
	theme?: 'red'
	onClick: () => void
}

// Vue unwraps only top-level refs in a template and this one hangs off an
// object, so it is aliased here.
const open = discardPrompt.show

// Escape, backdrop and close all just flip `show`. Without this the guard's
// promise never settles and navigation hangs for good; a dismissal reads as
// "keep editing". The re-entrant call from answerDiscard is harmless.
watch(open, (showing) => {
	if (!showing) answerDiscard(false)
})

const dialogActions = computed<DialogAction[]>(() => [
	{
		label: __('Keep editing'),
		onClick: () => answerDiscard(false),
	},
	{
		label: __('Discard'),
		variant: 'solid' as const,
		theme: 'red' as const,
		onClick: () => answerDiscard(true),
	},
])
</script>
