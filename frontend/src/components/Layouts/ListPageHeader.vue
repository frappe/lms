<template>
	<!-- The title + filters strip every list page repeats. Spacing and
	     breakpoints live here so a fix lands on all of them at once.

	     This block does not scroll: it and the app header above it stay put at
	     every width, and only the rows behind them move. Nothing here may grow
	     past its content, or it eats the space the rows scroll in. -->
	<div
		class="shrink-0 mb-5 flex flex-col justify-between px-5 pt-5 md:flex-row"
	>
		<h1 class="text-lg-semibold text-ink-gray-9 mb-4 md:mb-0">
			<slot name="title">{{ title }}</slot>
		</h1>
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:gap-x-4">
			<slot name="tabs" />
			<!-- gap, not space-y: ClearableCombobox's root is `display: contents`,
			     which generates no box, so a sibling margin on it is dropped and
			     the category control ends up flush against the search field. -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-x-4">
				<slot name="filters" />
			</div>
			<div v-if="$slots.toggles" :class="toggleGroupClass">
				<slot name="toggles" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useScreenSize } from '@/utils/composables'

withDefaults(defineProps<{ title?: string }>(), { title: '' })

const { isMobile } = useScreenSize()

const toggleGroupClass = computed(() =>
	isMobile.value
		? // Bled to the edges so the chips scroll the full width of the phone.
		  '-mx-5 flex gap-2 overflow-x-auto px-5'
		: 'flex items-center gap-x-4'
)
</script>
