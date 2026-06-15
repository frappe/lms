<template>
	<div class="flex h-screen w-screen">
		<div class="h-full border-e bg-surface-sidebar">
			<AppSidebar />
		</div>
		<div class="flex-1 flex flex-col h-full overflow-auto bg-surface-base">
			<slot />
		</div>
	</div>
</template>
<script setup>
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'
</script>
