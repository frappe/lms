<template>
	<div class="flex h-screen w-screen">
		<div class="h-full bg-surface-menu-bar">
			<AppSidebar />
		</div>
		<div class="flex-1 flex flex-col h-full overflow-hidden bg-surface-white">
			<AppHeader />
			<div class="flex-1 overflow-auto">
				<slot />
			</div>
		</div>
	</div>
</template>
<script setup>
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'
</script>
