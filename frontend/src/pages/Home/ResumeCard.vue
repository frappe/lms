<template>
	<section
		:aria-label="__('Pick up where you left off')"
		class="relative flex flex-wrap items-center gap-5 rounded-6 bg-surface-gray-1 px-5 py-4 transition-colors hover:bg-surface-gray-2"
	>
		<div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
			<div class="text-p-xs text-ink-gray-6">
				{{ __('Pick up where you left off') }}
			</div>
			<h2
				class="flex flex-wrap items-center gap-2 text-base font-semibold text-ink-gray-9"
			>
				{{ title }}
				<KindBadge v-if="kind" :kind="kind" size="sm" />
				<Badge v-if="draft" :label="__('Draft')" theme="amber" size="sm" />
			</h2>
			<div class="flex items-center gap-3">
				<div v-if="progress !== undefined" class="w-28 shrink-0">
					<Progress :value="progress" size="sm" />
				</div>
				<span class="text-p-sm text-ink-gray-6">{{ meta }}</span>
			</div>
		</div>
		<!-- The button's link stretches over the whole card, so any click on it continues. -->
		<Button
			class="!static after:absolute after:inset-0 after:rounded-6"
			variant="outline"
			size="md"
			:label="action"
			:route="route"
		/>
	</section>
</template>
<script setup lang="ts">
import { Badge, Button, Progress } from 'frappe-ui'
import KindBadge from '@/components/Home/KindBadge.vue'

defineProps<{
	title: string
	meta: string
	action: string
	route: Record<string, unknown>
	progress?: number
	draft?: boolean
	kind?: 'Skill' | 'Course' | 'Batch'
}>()
</script>
