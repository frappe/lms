<template>
	<div class="space-y-5">
		<div
			v-for="(point, i) in activity.content.points || []"
			:key="i"
			class="rounded-7 border border-outline-gray-2 bg-surface-base p-5"
		>
			<div class="flex items-start gap-3">
				<span
					class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-gray-2 text-p-xs text-ink-gray-7"
				>
					{{ i + 1 }}
				</span>
				<div class="min-w-0">
					<h3 class="text-base-medium text-ink-gray-9">{{ point.heading }}</h3>
					<p class="mt-1 text-p-base text-ink-gray-7">{{ point.body }}</p>
					<SourceTag :source="point.source" />
				</div>
			</div>
		</div>
		<div class="flex justify-end">
			<Button variant="solid" :loading="submitting" @click="emit('submit', {})">
				{{ activity.done ? __('Continue') : __('Got it') }}
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import SourceTag from '@/components/Goals/SourceTag.vue'

defineProps<{ activity: Record<string, any>; submitting: boolean }>()
const emit = defineEmits<{ submit: [response: Record<string, unknown>] }>()
</script>
