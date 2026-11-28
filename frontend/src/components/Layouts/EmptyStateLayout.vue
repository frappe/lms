<template>
	<div
		ref="root"
		data-empty-state
		:data-compact="compact || undefined"
		class="flex w-full flex-col items-center"
		:class="compact ? 'py-10' : 'h-full min-h-64 flex-1'"
	>
		<div v-if="hasSpacers" class="grow-[2]" aria-hidden="true" />
		<div
			ref="content"
			data-empty-state-content
			class="flex w-full shrink-0 flex-col items-center gap-3 px-6 sm:px-4"
			:class="widthClass"
			:style="offset === null ? undefined : { marginTop: `${offset}px` }"
		>
			<span
				class="size-10 text-ink-gray-5 sm:size-7.5"
				:class="icon"
				aria-hidden="true"
			/>
			<div class="flex flex-col items-center gap-1">
				<component
					:is="titleTag"
					class="text-base-medium text-center text-ink-gray-8 sm:text-lg-medium"
				>
					{{ computedTitle }}
				</component>
				<p class="text-center text-p-sm text-ink-gray-6 sm:text-p-base">
					{{ computedDescription }}
				</p>
			</div>
			<slot />
		</div>
		<div v-if="hasSpacers" class="grow-[3]" aria-hidden="true" />
	</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'

/**
 * The one empty state, and the owner of its vertical position. By default it
 * fills the space it is given and puts the centre of its copy at 45% of the
 * viewport height, whatever headers and toolbars sit above it, so every page,
 * panel and pane shows it at the same height. A box too short to reach that
 * line keeps the copy inside it; before layout, spacers split the space 2:3.
 * `compact` is a padded block for a card or a strip under other content.
 * Callers add no positional wrappers.
 */
const props = withDefaults(
	defineProps<{
		name: string
		title?: string
		description?: string
		icon?: string
		width?: 'sm' | 'md' | 'lg'
		compact?: boolean
		/** A heading tag when the title is the page's or section's heading. */
		titleTag?: 'span' | 'h1' | 'h2'
	}>(),
	{
		icon: 'lucide-graduation-cap',
		width: 'md',
		titleTag: 'span',
	}
)

const VIEWPORT_LINE = 0.45

const root = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const offset = ref<number | null>(null)
const hasSpacers = computed(() => !props.compact && offset.value === null)

function place() {
	if (props.compact || !root.value || !content.value) return
	const box = root.value.getBoundingClientRect()
	const height = content.value.offsetHeight
	if (!box.height) return
	const top = window.innerHeight * VIEWPORT_LINE - box.top - height / 2
	offset.value = Math.round(Math.min(Math.max(top, 0), box.height - height))
}

useResizeObserver(root, place)
useResizeObserver(content, place)
useEventListener(window, 'resize', place)

const computedTitle = computed(
	() => props.title || __('No {0} Found').format(__(props.name))
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
