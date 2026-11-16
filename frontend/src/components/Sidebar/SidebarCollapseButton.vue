<template>
	<SidebarItem
		:label="isCollapsed ? __('Expand') : __('Collapse')"
		@click="toggle"
	>
		<template #prefix>
			<span
				class="lucide-panel-right-open size-4 text-ink-gray-6 transition-transform duration-300 ease-in-out"
				:class="{ 'rotate-180': isCollapsed }"
			/>
		</template>
	</SidebarItem>
</template>

<script setup lang="ts">
/** frappe-ui's SidebarCollapseToggle, with a translated label. */
import { computed, inject } from 'vue'
import { SidebarItem, sidebarCollapsedKey, sidebarToggleKey } from 'frappe-ui'

const isCollapsed = inject(
	sidebarCollapsedKey,
	computed(() => false)
)
const toggle = inject(sidebarToggleKey, () => {})
</script>
