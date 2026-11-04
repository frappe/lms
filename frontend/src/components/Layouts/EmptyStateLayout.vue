<template>
	<div class="relative flex h-full min-h-64 w-full grow justify-center">
		<div
			class="absolute inset-x-0 top-1/3 mx-auto flex w-full flex-col items-center gap-3 px-6 sm:top-[35%] sm:px-4"
			:class="widthClass"
		>
			<span class="size-10 text-ink-gray-5 sm:size-7.5" :class="icon" />
			<div class="flex flex-col items-center gap-1">
				<span
					class="text-base-medium text-center text-ink-gray-8 sm:text-lg-medium"
				>
					{{ computedTitle }}
				</span>
				<span class="text-center text-p-sm text-ink-gray-6 sm:text-p-base">
					{{ computedDescription }}
				</span>
			</div>
			<slot />
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

// The fractional widths are desktop-only. Unqualified, `w-4/12` is about 130px
// on a 390px phone, which wrapped the copy into a sliver a word or two wide.
// The base `w-full` holds until `sm`, and these take over from there.
//
// Centring is `inset-x-0 mx-auto` rather than the half-offset-and-translate
// pair it replaced: same result, no physical inline-axis class for the RTL
// rule to catch.
const widthClass = computed(() => {
	switch (props.width) {
		case 'sm':
			return 'sm:w-2/12'
		case 'lg':
			return 'sm:w-8/12'
		default:
			return 'sm:w-4/12'
	}
})
</script>
