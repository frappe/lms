<template>
	<BooleanSwitch
		v-model="enabled"
		variant="compact"
		size="sm"
		:label="enabled ? on : off"
	>
		<template #label>
			<span class="flex items-center gap-2">
				<span
					class="size-4 shrink-0"
					:class="[icon, enabled ? 'text-ink-gray-5' : 'text-ink-gray-4']"
					aria-hidden="true"
				/>
				<span :class="!enabled && 'text-ink-gray-6'">
					{{ enabled ? on : off }}
				</span>
			</span>
		</template>
	</BooleanSwitch>
</template>

<script setup lang="ts">
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'

/** A card fact that reads as text and toggles in place. */
defineProps<{ icon: string; on: string; off: string }>()
const enabled = defineModel<boolean | 0 | 1 | undefined>({ required: true })
</script>
