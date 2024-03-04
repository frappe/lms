<template>
	<div class="flex h-full flex-col">
		<div class="h-full overflow-auto" id="scrollContainer">
			<slot />
		</div>
		<div
			v-if="tabs"
			class="grid grid-cols-5 border-t border-gray-300 standalone:pb-4"
			:style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }"
		>
			<button
				v-for="tab in tabs"
				:key="tab.label"
				class="flex flex-col items-center justify-center py-3 transition active:scale-95"
				@click="handleClick(tab)"
			>
				<component :is="tab.icon" class="h-6 w-6 stroke-1.5 text-gray-700" />
			</button>
		</div>
	</div>
</template>
<script setup>
import { getSidebarLinks } from '../utils'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const router = useRouter()
const tabs = computed(() => {
	return getSidebarLinks()
})

/* let isActive = computed((tab) => {
	console.log(tab);
	return router.currentRoute.value.name === tab.to
}) */

const handleClick = (tab) => {
	router.push({ name: tab.to })
}
</script>
