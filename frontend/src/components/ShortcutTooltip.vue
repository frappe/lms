<template>
	<Tooltip v-if="!disabled" :text="`${label} (${shortcut})`">
		<slot />
	</Tooltip>
	<slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip } from 'frappe-ui'

const props = withDefaults(
	defineProps<{
		label: string
		combo?: string
		disabled?: boolean
	}>(),
	{
		combo: 'Mod+S',
		disabled: false,
	}
)

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

const shortcut = computed(() =>
	isMac
		? props.combo.replace('Mod+', '⌘').replace('Shift+', '⇧')
		: props.combo.replace('Mod', 'Ctrl')
)
</script>
