<template>
	<div
		class="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 px-4"
	>
		<component :is="icon" class="size-7.5 stroke-1 text-ink-gray-5" />
		<div class="flex flex-col items-center gap-1" :class="widthClass">
			<span class="text-lg font-medium text-ink-gray-8 text-center">
				{{ computedTitle }}
			</span>
			<span class="text-center text-p-base text-ink-gray-6">
				{{ computedDescription }}
			</span>
		</div>
	</div>
</template>
<script setup lang="ts">
import { GraduationCap } from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		name: string
		title?: string
		description?: string
		icon?: Component
		width?: 'sm' | 'md' | 'lg'
	}>(),
	{
		icon: () => GraduationCap,
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
