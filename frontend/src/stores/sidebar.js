import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebar = defineStore('sidebar', () => {
	const isSidebarCollapsed = ref(false)

	return {
		isSidebarCollapsed,
	}
})
