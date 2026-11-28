<template>
	<nav :aria-label="__('Settings sections')" class="space-y-1">
		<p class="px-2 pb-1 text-p-sm text-ink-gray-6">
			{{
				sections.length === 1
					? __('1 section')
					: __('{0} sections').format(sections.length)
			}}
		</p>
		<button
			v-for="section in sections"
			:key="section.id"
			type="button"
			class="flex w-full items-center h-7 gap-2 rounded-4 px-2 text-start text-p-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			:class="
				section.id === active
					? 'bg-surface-gray-2 text-ink-gray-9'
					: 'text-ink-gray-7 hover:bg-surface-gray-1'
			"
			:aria-current="section.id === active ? 'location' : undefined"
			@click="emit('select', section)"
		>
			<span
				class="size-4 shrink-0"
				:class="section.icon || 'lucide-settings-2'"
				aria-hidden="true"
			/>
			<span class="truncate">{{ section.title }}</span>
		</button>
	</nav>
</template>

<script setup lang="ts">
import type { SettingsSection } from '@/components/InlineEdit/settingsSections'

/** The page's settings sections; the one in view is marked. */
defineProps<{ sections: SettingsSection[]; active: string | null }>()
const emit = defineEmits<{ select: [section: SettingsSection] }>()
</script>
