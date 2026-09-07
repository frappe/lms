<template>
	<div
		class="flex min-h-full flex-col"
		:class="grouped ? 'bg-surface-gray-1' : 'bg-surface-base'"
	>
		<header v-if="showHeader" class="header-frame sticky top-0 z-10 gap-1">
			<button
				v-if="showBack"
				type="button"
				data-testid="mobile-page-back"
				:aria-label="__('Back')"
				class="-ms-3 shrink-0 rounded p-1.5 text-ink-gray-9 transition-colors hover:bg-surface-gray-2"
				@click="emit('back')"
			>
				<span class="lucide-chevron-left size-4 block" />
			</button>
			<h1 class="min-w-0 flex-1 truncate text-lg-medium text-ink-gray-9">
				{{ title }}
			</h1>
			<slot name="header-actions" />
		</header>
		<h1 v-else class="sr-only">{{ title }}</h1>

		<div
			data-testid="mobile-page-body"
			class="flex flex-1 flex-col gap-5 px-5 pb-safe-6 pt-4"
		>
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
// Does NOT scroll: MobileLayout's <main id="scrollContainer"> is the app's one
// scroller, and a second one here left that element static, pointing the
// skip-to-content link and scroll-to-top at a box that could not move. FormShell
// keeps its own scroller — it is `fixed inset-0`, outside this container.
//
// Exactly one h1 renders whether or not the header shows: root tabs take their
// identity from the bottom bar, but the heading rotors still need a name.
withDefaults(
	defineProps<{
		title: string
		showBack?: boolean
		/** Root tabs draw no title bar; `title` still ships as an sr-only h1. */
		showHeader?: boolean
		/** Pages of grouped cards sit on the sunken surface; plain pages do not. */
		grouped?: boolean
	}>(),
	{ showBack: true, showHeader: true, grouped: false }
)

const emit = defineEmits<{ back: [] }>()
</script>
