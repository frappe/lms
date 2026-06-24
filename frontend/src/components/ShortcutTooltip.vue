<template>
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
		<slot />
	</Tooltip>
	<slot v-else />
</template>

<script setup lang="ts">
// Mirrors apps/crm/frontend/src/components/ShortcutTooltip.vue. frappe-ui's
// KeyboardShortcut already renders "Mod+S" as ⌘S on mac / Ctrl+S elsewhere, so
// CRM's local platform-normalization is unnecessary here.
import { Tooltip, KeyboardShortcut } from 'frappe-ui'

withDefaults(
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
</script>
