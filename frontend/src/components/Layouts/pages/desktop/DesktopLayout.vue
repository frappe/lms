<template>
	<div class="flex h-dvh w-screen">
		<a
			href="#main-content"
			@click.prevent="skipToContent('main-content')"
			class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-4 focus:bg-surface-base focus:px-4 focus:py-2 focus:text-ink-gray-9 focus:shadow-md focus:focus-ring"
		>
			{{ __('Skip to main content') }}
		</a>
		<div class="h-full border-e bg-surface-sidebar">
			<AppSidebar />
		</div>
		<main
			id="main-content"
			tabindex="-1"
			class="flex h-full flex-1 flex-col overflow-hidden bg-surface-base focus:outline-none"
		>
			<ScrollArea class="min-h-0 flex-1" viewportClass="min-h-0 flex flex-col">
				<slot />
			</ScrollArea>
		</main>
	</div>
</template>
<script setup>
import { skipToContent } from '@/utils/a11y'
import { ScrollArea } from 'frappe-ui'
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'
</script>
