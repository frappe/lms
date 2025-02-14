import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebar = defineStore('sidebar', () => {
	const isSidebarCollapsed = ref(false)
	const isWebpagesCollapsed = ref(true)

	if (localStorage.getItem('isSidebarCollapsed')) {
		isSidebarCollapsed.value = JSON.parse(
			localStorage.getItem('isSidebarCollapsed')
		)
	}

	if (localStorage.getItem('isWebpagesCollapsed')) {
		isWebpagesCollapsed.value = JSON.parse(
			localStorage.getItem('isWebpagesCollapsed')
		)
	}

	return {
		isSidebarCollapsed,
		isWebpagesCollapsed,
	}
})
