<template>
	<div class="flex h-full flex-col">
		<div class="h-full overflow-auto" id="scrollContainer">
			<slot />
		</div>
		<div
			class="grid grid-cols-5 border-t border-gray-300 standalone:pb-4"
			:style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }"
		>
			<button
				v-for="tab in tabs"
				:key="tab.label"
				class="flex flex-col items-center justify-center py-3 transition active:scale-95"
				@click="handleClick(tab)"
			>
				<component
					:is="tab.icon"
					class="h-6 w-6"
					:class="[isActive(tab) ? 'text-gray-900' : 'text-gray-600']"
				/>
			</button>
		</div>
	</div>
</template>
<script>
import { scrollTo } from '@/utils/scrollContainer'
import { getSidebarLinks } from '../utils'
import { useRouter } from 'vue-router'

const router = useRouter()
const tabs = getSidebarLinks()

let isActive = computed((tab) => {
	return router.currentRoute.value.name === tab.to
})

const handleClick = (tab) => {
	router.push({ name: tab.to })
}
</script>
