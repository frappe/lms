<template>
	<div
		class="rounded-7 border border-outline-gray-2 bg-surface-base p-4 shadow-sm"
	>
		<div
			class="mb-3 flex items-center gap-1.5 text-p-xs font-medium text-ink-gray-6"
		>
			<span class="size-3.5" :class="meta.icon" />
			{{ meta.label }}
			<Badge
				v-if="result"
				class="ms-auto"
				size="sm"
				:theme="result.correct ? 'green' : 'amber'"
				:label="result.correct ? __('Got it') : __('Worth a second look')"
			/>
		</div>
		<component
			:is="meta.component"
			:moment="moment"
			:result="result"
			:active="active"
			@answer="
				(answer: Record<string, unknown>) =>
					emit('answer', {
						id,
						kind: moment.kind,
						idea: moment.idea,
						...answer,
					})
			"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import SpotMoment from './SpotMoment.vue'
import OrderMoment from './OrderMoment.vue'
import RateMoment from './RateMoment.vue'
import BetMoment from './BetMoment.vue'
import ChooseMoment from './ChooseMoment.vue'
import BuildMoment from './BuildMoment.vue'

const props = defineProps<{
	id: string
	moment: Record<string, any>
	result?: Record<string, any> | null
	/** The newest unanswered exercise, which the keyboard answers. */
	active?: boolean
}>()
const emit = defineEmits<{ answer: [payload: Record<string, unknown>] }>()

const KINDS = {
	spot: {
		component: SpotMoment,
		icon: 'lucide-scan-search',
		label: __('Spot it'),
	},
	order: {
		component: OrderMoment,
		icon: 'lucide-list-ordered',
		label: __('Put it in order'),
	},
	rate: {
		component: RateMoment,
		icon: 'lucide-gauge',
		label: __('Where does it sit?'),
	},
	bet: {
		component: BetMoment,
		icon: 'lucide-dices',
		label: __('Place your bet'),
	},
	choose: {
		component: ChooseMoment,
		icon: 'lucide-split',
		label: __('Your call'),
	},
	build: {
		component: BuildMoment,
		icon: 'lucide-blocks',
		label: __('Build it'),
	},
} as const

const meta = computed(
	() => KINDS[props.moment.kind as keyof typeof KINDS] || KINDS.choose
)
</script>
