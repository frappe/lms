import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebar = defineStore('sidebar', () => {
	const isSidebarCollapsed = ref(false)
	// One entry per group, because a sidebar can now carry several. Absent
	// means collapsed, the way the web-pages disclosure has always opened, so
	// only a group the reader has opened is stored.
	const openSidebarGroups = ref({})

	if (localStorage.getItem('isSidebarCollapsed')) {
		isSidebarCollapsed.value = JSON.parse(
			localStorage.getItem('isSidebarCollapsed')
		)
	}

	// A reader who had the old single disclosure open keeps it open, under the
	// key the synthesised group now uses.
	const storedGroups = localStorage.getItem('openSidebarGroups')
	if (storedGroups) {
		openSidebarGroups.value = JSON.parse(storedGroups)
	} else if (localStorage.getItem('isWebpagesCollapsed') === 'false') {
		openSidebarGroups.value = { web_pages: true }
	}

	const isGroupOpen = (key) => Boolean(openSidebarGroups.value[key])

	const toggleGroup = (key) => {
		openSidebarGroups.value = {
			...openSidebarGroups.value,
			[key]: !isGroupOpen(key),
		}
		localStorage.setItem(
			'openSidebarGroups',
			JSON.stringify(openSidebarGroups.value)
		)
	}

	return {
		isSidebarCollapsed,
		openSidebarGroups,
		isGroupOpen,
		toggleGroup,
	}
})
