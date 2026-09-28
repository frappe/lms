<template>
	<div
		class="flex min-h-11 items-center justify-between gap-3 border-b border-outline-gray-1 bg-surface-gray-1 px-3"
	>
		<div class="flex min-w-0 items-center gap-x-2">
			<span :class="[icon, 'size-4 shrink-0 text-ink-gray-6']" />
			<h2 class="shrink-0 text-sm-semibold text-ink-gray-9">{{ title }}</h2>
			<template v-if="subtitle">
				<span
					data-testid="header-separator"
					class="size-1 shrink-0 rounded-full bg-surface-gray-4"
				/>
				<span class="truncate text-xs text-ink-gray-5">{{ subtitle }}</span>
			</template>
		</div>
		<div class="flex shrink-0 items-center gap-x-2">
			<Badge v-if="preview" theme="gray" variant="solid" size="sm">
				{{ __('Preview only') }}
			</Badge>
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'

withDefaults(
	defineProps<{
		icon: string
		title: string
		subtitle?: string
		preview?: boolean
	}>(),
	{ subtitle: undefined, preview: false }
)
</script>
