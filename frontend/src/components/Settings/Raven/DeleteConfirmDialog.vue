<template>
	<Dialog
		v-model:open="open"
		:title="__('Delete {0}?').format(name)"
		:message="
			message ||
			__(
				'This deletes the {0} mapping and its membership rules, and stops syncing members. This cannot be undone.'
			).format(entityName)
		"
		size="sm"
		:actions="dialogActions"
	/>
</template>

<script setup lang="ts">
// Deleting a mapping leaves the Raven record alone, so no
// type-the-name-to-confirm gate.
import { Dialog } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps<{
	/** Name of the thing being deleted, shown in the title. */
	name: string
	/** What kind of thing is being deleted ("workspace" / "channel"). */
	entity?: string
	message?: string
	/** Runs the delete. Delete button spins until the promise settles. */
	onConfirm: () => Promise<unknown> | void
}>()
const open = defineModel<boolean>('open')

interface DialogAction {
	label: string
	variant?: 'solid'
	theme?: 'red'
	onClick: (context: { close: () => void }) => Promise<unknown> | void
}

const entityName = computed<string>(() => props.entity || 'workspace')

const dialogActions = computed<DialogAction[]>(() => [
	{
		label: __('Cancel'),
		onClick: ({ close }: { close: () => void }) => close(),
	},
	{
		label: __('Delete'),
		variant: 'solid' as const,
		theme: 'red' as const,
		onClick: () => props.onConfirm(),
	},
])
</script>
