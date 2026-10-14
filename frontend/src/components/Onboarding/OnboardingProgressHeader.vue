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
				size="sm"
				data-testid="reset-all"
				@click="emit('reset')"
			>
				<span :class="ROW_TEXT">{{ text.resetAll }}</span>
			</Button>
			<Button
				v-if="percent !== 100"
				variant="ghost"
				size="sm"
				data-testid="skip-all"
				@click="emit('skip')"
			>
				<span :class="ROW_TEXT">{{ text.skipAll }}</span>
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button } from 'frappe-ui'
import { ROW_TEXT } from '@/onboarding/rowClasses'

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
