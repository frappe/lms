<template>
	<!-- The title + filters strip every list page repeats. Spacing and
	     breakpoints live here so a fix lands on all of them at once.

	     It scrolls with the rows, at every width, and is never pinned: it
	     belongs to the list rather than to the page chrome, and holding it still
	     spends a third of a phone screen on controls the reader has already
	     used. Only the app header above and the footer below stay put.

	     Pinning it here would also be the old bug back: LayoutHeader is `sticky
	     top-0` in the same scroller, so a second `sticky top-0` lands underneath
	     it and loses its first 49px, and the offset that would clear it is the
	     app header's own content height — the measurement that drifted and
	     opened a band. It gets a rule on a phone instead, where it runs the full
	     width and the rows begin straight under it. -->
	<div
		class="mb-5 flex shrink-0 flex-col justify-between border-b px-5 pb-4 pt-5 sm:border-b-0 sm:pb-0 md:flex-row"
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
