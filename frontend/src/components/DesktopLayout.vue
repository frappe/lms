<template>
	<div class="relative flex h-full flex-col">
		<div class="h-full flex-1">
			<div class="flex h-screen text-base bg-surface-white">
				<div
					class="relative block min-h-0 flex-shrink-0 overflow-hidden hover:overflow-auto"
				>
					<AppSidebar />
				</div>
				<div class="w-full overflow-auto" id="scrollContainer">
					<div
						v-if="readOnlyMode"
						class="right-0 top-0 mb-3 bg-surface-gray-2 py-3 text-sm text-ink-gray-5"
					>
						<div class="mx-auto px-10">
							{{
								__(
									'This site is running in read-only mode. Full functionality will be restored soon.'
								)
							}}
						</div>
					</div>
					<slot />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import AppSidebar from './AppSidebar.vue'

const readOnlyMode = window.read_only_mode
</script>
