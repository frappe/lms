<template>
	<div
		data-testid="assessment-card-header"
		class="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-outline-gray-1 bg-surface-gray-1 px-3 py-2"
	>
		<div
			data-testid="header-heading"
			class="flex min-w-0 grow basis-48 items-center gap-x-2"
		>
			<span :class="[icon, 'size-4 shrink-0 text-ink-gray-6']" />
			<h2
				class="min-w-0 max-w-full shrink-0 truncate text-sm-semibold text-ink-gray-9"
			>
				{{ title }}
			</h2>
			<template v-if="subtitle">
				<span
					data-testid="header-separator"
					class="size-1 shrink-0 rounded-full bg-surface-gray-4"
				/>
				<span class="min-w-0 truncate text-xs text-ink-gray-5">
					{{ subtitle }}
				</span>
			</template>
		</div>
		<div
			data-testid="header-actions"
			class="ms-auto flex shrink-0 items-center gap-x-2"
		>
			<Badge
				v-if="preview"
				class="whitespace-nowrap"
				theme="gray"
				variant="solid"
				size="sm"
			>
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
