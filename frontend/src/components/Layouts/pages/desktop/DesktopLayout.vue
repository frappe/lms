<template>
	<div class="flex h-dvh w-screen">
		<a
			href="#main-content"
			@click.prevent="skipToContent('main-content')"
			class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-4 focus:bg-surface-base focus:px-4 focus:py-2 focus:text-ink-gray-9 focus:shadow-md focus:focus-ring"
		>
			{{ __('Skip to main content') }}
		</a>
		<div v-if="!isSidebarHidden" class="h-full border-e bg-surface-sidebar">
			<AppSidebar />
		</div>
		<main
			id="main-content"
			tabindex="-1"
			class="flex-1 flex flex-col h-full overflow-auto bg-surface-base focus:outline-none"
		>
			<slot />
		</main>
	</div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { skipToContent } from '@/utils/a11y'
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'
import { isSidebarHidden as isExamSidebarHidden } from '@/stores/sidebar'

const isFullscreen = ref(false)

const updateFullscreen = () => {
	if (typeof document === 'undefined') return
	isFullscreen.value = Boolean(
		document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.msFullscreenElement
	)
}

onMounted(() => {
	updateFullscreen()
	document.addEventListener('fullscreenchange', updateFullscreen)
	document.addEventListener('webkitfullscreenchange', updateFullscreen)
	document.addEventListener('msfullscreenchange', updateFullscreen)
})

onBeforeUnmount(() => {
	document.removeEventListener('fullscreenchange', updateFullscreen)
	document.removeEventListener('webkitfullscreenchange', updateFullscreen)
	document.removeEventListener('msfullscreenchange', updateFullscreen)
})

const isSidebarHidden = computed(() =>
	Boolean(isExamSidebarHidden.value || isFullscreen.value)
)
</script>
