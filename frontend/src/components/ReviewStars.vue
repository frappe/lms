<template>
	<div
		class="flex gap-1"
		role="img"
		:aria-label="__('{0} out of 5').format(rounded)"
	>
		<LucideStar
			v-for="i in 5"
			:key="i"
			class="size-4 text-transparent"
			:class="i <= rounded ? 'fill-ink-amber-7' : 'fill-surface-gray-3'"
			aria-hidden="true"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { starBucket } from '@/utils/reviews'

/** Five stars, filled up to the rating's star. */
const props = defineProps<{ rating: number }>()

const rounded = computed(() => (props.rating ? starBucket(props.rating) : 0))
</script>
