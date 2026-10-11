<template>
<<<<<<< HEAD
	<Tooltip v-if="!disabled">
		<template #body>
			<div
				class="rounded bg-surface-gray-10 py-1.5 px-2 text-xs text-ink-base shadow-xl"
			>
				<span class="flex items-center gap-1.5">
					<span>{{ label }}</span>
					<KeyboardShortcut
						bg
						class="!bg-surface-gray-5 !text-ink-gray-2 px-1"
						:combo="combo"
					/>
				</span>
			</div>
		</template>
=======
	<Tooltip v-if="!disabled" :text="`${label} (${shortcut})`">
>>>>>>> b627589 (fix(ui): show save shortcut as plain tooltip text, not keycaps)
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
