<template>
	<Dialog
		v-model="open"
		:title="title"
		:message="message"
		size="sm"
		:actions="[
			{
				label: __('Cancel'),
				onClick: onCancel,
			},
			{
				label: confirmLabel,
				variant: 'solid',
				theme: removedCount > 0 ? 'red' : 'gray',
				onClick: onConfirm,
			},
		]"
	/>
</template>

<script setup lang="ts">
// Count-only. The backend also returns sample usernames; listing them made the
// dialog unreadable at realistic sizes.
import { Dialog } from 'frappe-ui'
import { computed, watch } from 'vue'

const props = withDefaults(
	defineProps<{
		removedCount: number
		/** Non-zero only for a combinator switch: All (AND) → Any (OR) admits people. */
		addedCount?: number
		targetLabel: string
	}>(),
	{ addedCount: 0 }
)

const emit = defineEmits<{
	confirm: []
	cancel: []
}>()

const open = defineModel<boolean>('open')

// Escape and the overlay close the dialog without touching an action, so closing
// is the cancel: without it the caller keeps holding an edit it never applied.
let settled = false

watch(open, (isOpen) => {
	if (isOpen) {
		settled = false
		return
	}
	if (settled) return
	settled = true
	emit('cancel')
})

const bothWays = computed<boolean>(
	() => props.addedCount > 0 && props.removedCount > 0
)
const addOnly = computed<boolean>(
	() => props.addedCount > 0 && props.removedCount === 0
)

const title = computed<string>(() => {
	if (bothWays.value) return __('Change who is a member?')
	if (addOnly.value) return __('Add members?')
	return __('Remove members?')
})

const message = computed<string>(() => {
	if (bothWays.value)
		return __(
			'This will add {0} members to {1} and remove {2}. The removals cannot be undone. Cancel to keep the current membership.'
		).format(props.addedCount, props.targetLabel, props.removedCount)
	if (addOnly.value)
		return __(
			'This will add {0} members to {1}. Cancel to keep the current membership.'
		).format(props.addedCount, props.targetLabel)
	return __(
		'This will remove {0} members from {1}. This cannot be undone.'
	).format(props.removedCount, props.targetLabel)
})

const confirmLabel = computed<string>(() => {
	if (bothWays.value)
		return __('Add {0}, remove {1}').format(
			props.addedCount,
			props.removedCount
		)
	if (addOnly.value) return __('Add {0} members').format(props.addedCount)
	return __('Remove {0} members').format(props.removedCount)
})

function onConfirm(): void {
	settled = true
	open.value = false
	emit('confirm')
}

function onCancel(): void {
	if (settled) return
	settled = true
	open.value = false
	emit('cancel')
}
</script>
