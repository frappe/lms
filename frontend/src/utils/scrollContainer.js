export function scrollTo(...options) {
	if (!options || options.length === 0) return
	const container = getScrollContainer()
	if (!container) return
	container.scrollTo(...options)
}

export function getScrollContainer() {
	// window.scrollContainer is reference to the scroll container in DesktopLayout.vue and MobileLayout.vue
	return window.scrollContainer
}
