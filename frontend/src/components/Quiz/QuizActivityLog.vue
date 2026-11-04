<template>
	<div class="space-y-1">
		<div class="flex items-baseline justify-between gap-3">
			<h3 class="text-sm-semibold text-ink-gray-9">{{ __('Activity') }}</h3>
			<span data-testid="activity-tally" class="text-sm text-ink-gray-6">
				{{ tally }}
			</span>
		</div>
		<ol class="divide-y divide-outline-gray-1">
			<li
				v-for="(entry, index) in entries"
				:key="index"
				data-testid="activity-row"
				class="flex items-center gap-3 py-2.5"
			>
				<span
					class="w-11 shrink-0 font-mono text-xs tabular-nums text-ink-gray-6"
				>
					{{ when(entry) }}
				</span>
				<span class="min-w-0 flex-1 text-base text-ink-gray-8">
					{{ violationLabel(entry.eventType) }}
				</span>
				<!-- A saved still is a file link and opens larger; one from this attempt
				     is an inline image, which browsers will not open as a page. -->
				<a
					v-if="safeUrl(entry.frame)"
					v-external
					:href="safeUrl(entry.frame)"
					class="shrink-0"
				>
					<img
						:src="safeUrl(entry.frame)"
						:alt="__('Camera at {0}').format(violationLabel(entry.eventType))"
						class="h-8 w-11 rounded-4 border object-cover"
					/>
				</a>
				<img
					v-else-if="safeUrl(entry.frame, { inlineImage: true })"
					:src="safeUrl(entry.frame, { inlineImage: true })"
					:alt="__('Camera at {0}').format(violationLabel(entry.eventType))"
					class="h-8 w-11 shrink-0 rounded-4 border object-cover"
				/>
				<Badge
					size="sm"
					:theme="entry.severity === 'violation' ? 'red' : 'orange'"
				>
					{{ entry.severity === 'violation' ? __('Violation') : __('Warning') }}
				</Badge>
			</li>
		</ol>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import { safeUrl } from '@/utils/safeUrl'
import { violationLabel } from '@/utils/proctoring'
import type { ViolationEvent } from '@/types'

const props = defineProps<{
	// Newest first, as the quiz records them.
	entries: ViolationEvent[]
}>()

const tally = computed(() => {
	const violations = props.entries.filter(
		(e) => e.severity === 'violation'
	).length
	const warnings = props.entries.length - violations
	const parts: string[] = []
	if (violations) {
		parts.push(
			`${violations} ${violations == 1 ? __('violation') : __('violations')}`
		)
	}
	if (warnings) {
		parts.push(`${warnings} ${warnings == 1 ? __('warning') : __('warnings')}`)
	}
	return parts.join(', ')
})

const pad = (n: number) => String(n).padStart(2, '0')

// Time into the attempt when this page saw the event happen. A row read back
// from the server carries only its site-time timestamp, so it shows the clock.
const when = (entry: ViolationEvent): string => {
	if (entry.elapsed != null) {
		const seconds = Math.max(0, Math.round(entry.elapsed))
		return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
	}
	const clock = /(\d{2}):(\d{2})(?::\d{2})?/.exec(entry.timestamp ?? '')
	return clock ? `${clock[1]}:${clock[2]}` : ''
}
</script>
