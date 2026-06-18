<template>
	<div class="relative flex h-full w-full justify-center">
		<div
			class="absolute left-1/2 top-[35%] flex -translate-x-1/2 flex-col items-center gap-3 px-4"
			:class="widthClass"
		>
			<span class="size-7.5 text-ink-gray-5" :class="icon" />
			<div class="flex flex-col items-center gap-1">
				<span class="text-xl-medium text-center text-ink-gray-8">
					{{ computedTitle }}
				</span>
				<span class="text-center text-p-base text-ink-gray-6">
					{{ computedDescription }}
				</span>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		name: string
		title?: string
		description?: string
		icon?: string
		width?: 'sm' | 'md' | 'lg'
	}>(),
	{
		icon: 'lucide-graduation-cap',
		width: 'md',
	}
)

const computedTitle = computed(
	() => props.title || __('No {0} Found').format(props.name)
)

const computedDescription = computed(
	() =>
		props.description ||
		__(
			'There are no {0} currently. Keep an eye out, fresh learning experiences are on the way!'
		).format(props.name?.toLowerCase())
)

const widthClass = computed(() => {
	switch (props.width) {
		case 'sm':
			return 'w-2/12'
		case 'lg':
			return 'w-8/12'
		default:
			return 'w-4/12'
	}
})
</script>
