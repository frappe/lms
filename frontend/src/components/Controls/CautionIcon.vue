<template>
	<Tooltip>
		<Button variant="ghost" size="sm" class="-my-1" :aria-label="text">
			<template #icon>
				<span
					class="lucide-circle-alert size-3.5 text-ink-gray-6"
					aria-hidden="true"
				/>
			</template>
		</Button>
		<template #content>
			<div class="max-w-xs text-p-xs">
				{{ text }}
			</div>
		</template>
	</Tooltip>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'

defineProps<{ text: string }>()
</script>
