<template>
	<div class="flex h-full flex-col">
		<div class="h-full pb-10" id="scrollContainer">
			<slot />
		</div>
		<div
			v-if="tabs"
			class="fixed flex justify-around border-t border-gray-300 bottom-0 z-10 w-full bg-white standalone:pb-4"
			:style="{
				gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
			}"
		>
			<button
				v-for="tab in tabs"
				:key="tab.label"
				:class="isVisible(tab) ? 'block' : 'hidden'"
				class="flex flex-col items-center justify-center py-3 transition active:scale-95"
				@click="handleClick(tab)"
			>
				<component
					:is="tab.icon"
					class="h-6 w-6 stroke-1.5"
					:class="[isActive(tab) ? 'text-gray-900' : 'text-gray-600']"
				/>
			</button>
		</div>
	</div>
</template>
<script setup>
import { getSidebarLinks } from '../utils'
import { useRouter } from 'vue-router'
import { computed, inject } from 'vue'
import { sessionStore } from '@/stores/session'

const { logout, user } = sessionStore()
let { isLoggedIn } = sessionStore()

const router = useRouter()
const tabs = computed(() => {
	return getSidebarLinks()
})

let isActive = (tab) => {
	return tab.activeFor?.includes(router.currentRoute.value.name)
}

const handleClick = (tab) => {
	if (tab.label == 'Log in') window.location.href = '/login'
	else if (tab.label == 'Log out')
		logout.submit().then(() => {
			isLoggedIn = false
		})
	else router.push({ name: tab.to })
}

const isVisible = (tab) => {
	if (tab.label == 'Log in') return !isLoggedIn
	else if (tab.label == 'Log out') return isLoggedIn
	else return true
}
</script>
