<template>
	<div class="flex items-center justify-between py-0.5" data-testid="badge-row">
		<Badge
			:label="percentLabel"
			:theme="percent === 100 ? 'green' : 'amber'"
			size="lg"
		/>
		<div class="flex">
			<Button
				v-if="canReset"
				variant="ghost"
				:label="text.resetAll"
				@click="emit('reset')"
			/>
			<Button
				v-if="percent !== 100"
				variant="ghost"
				:label="text.skipAll"
				@click="emit('skip')"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button } from 'frappe-ui'

const props = defineProps<{ percent: number; canReset: boolean }>()

const emit = defineEmits<{ reset: []; skip: [] }>()

const text = {
	resetAll: __('Reset all'),
	skipAll: __('Skip all'),
}

const percentLabel = computed<string>(() =>
	__('{0}% completed').format(String(props.percent))
)
</script>
