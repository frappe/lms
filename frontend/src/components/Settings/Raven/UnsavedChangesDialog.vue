<template>
	<Dialog
		v-model="open"
		:title="__('Leave without saving?')"
		:message="__('You have unsaved changes, leave anyway?')"
		size="sm"
		:actions="dialogActions"
	/>
</template>

<script setup lang="ts">
// The same shape as DeleteConfirmDialog next door: a thin wrapper over frappe-ui's
// Dialog with the buttons as a computed, rather than a modal built by hand.
//
// Leaving is the destructive half here, since the edits are what is lost, so it takes
// the red solid button, as the delete confirmation's does.
import { Dialog } from 'frappe-ui'
import { computed } from 'vue'

const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open')

interface DialogAction {
	label: string
	variant?: 'solid'
	theme?: 'red'
	onClick: (context: { close: () => void }) => void
}

const dialogActions = computed<DialogAction[]>(() => [
	{
		label: __('Cancel'),
		onClick: ({ close }: { close: () => void }) => close(),
	},
	{
		label: __('Leave'),
		variant: 'solid' as const,
		theme: 'red' as const,
		onClick: () => emit('confirm'),
	},
])
</script>
