<template>
	<div class="flex h-screen w-screen">
		<div class="h-full border-r bg-surface-menu-bar">
			<AppSidebar />
		</div>
		<div class="flex-1 flex flex-col h-full overflow-auto bg-surface-white">
			<slot />
		</div>
	</div>
</template>
<script setup>
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
</script>
