<template>
	<div class="grid grid-cols-2 gap-2">
		<TimePicker
			v-model="start"
			variant="ghost"
			format="h:mm a"
			:interval="15"
			:max="end ? toMinutes(end) : undefined"
			:placeholder="__('Start')"
			:aria-label="startLabel || __('Start time')"
		>
			<template #prefix>
				<span
					class="lucide-sunrise size-4 text-ink-gray-5"
					aria-hidden="true"
				/>
			</template>
		</TimePicker>
		<TimePicker
			v-model="end"
			variant="ghost"
			format="h:mm a"
			:interval="15"
			:min="start ? toMinutes(start) : undefined"
			:placeholder="__('End')"
			:aria-label="endLabel || __('End time')"
		>
			<template #prefix>
				<span class="lucide-sunset size-4 text-ink-gray-5" aria-hidden="true" />
			</template>
		</TimePicker>
	</div>
</template>

<script setup lang="ts">
import { TimePicker } from 'frappe-ui'

/** A start and end time; each bounds the other, so the range cannot end before it starts. */
defineProps<{ startLabel?: string; endLabel?: string }>()
const start = defineModel<string | null | undefined>('start')
const end = defineModel<string | null | undefined>('end')

// Frappe stores HH:mm:ss; the picker bounds compare HH:mm.
const toMinutes = (time: string): string => time.slice(0, 5)
</script>
