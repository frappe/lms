<template>
	<div class="flex flex-wrap items-center gap-x-2 gap-y-1" data-rating-summary>
		<span class="text-[16px] font-semibold tabular-nums text-ink-gray-8">
			{{ average ? average.toFixed(1) : '–' }}
		</span>
		<Rating
			:model-value="average"
			:step="0.5"
			:disabled="true"
			aria-hidden="true"
		/>
		<span class="text-[13px] text-ink-gray-6">{{ reviewsText }}</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Rating } from 'frappe-ui'

const props = defineProps<{ average: number; reviews: number }>()

const reviewsText = computed(() =>
	props.reviews === 1
		? __('1 review')
		: __('{0} reviews').format(props.reviews.toLocaleString())
)
</script>
