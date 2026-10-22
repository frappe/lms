<template>
	<div class="space-y-3">
		<p class="text-p-base text-ink-gray-8">
			{{ summaryLine(result, skipped.length) }}
		</p>
		<ul v-if="reasons.length" class="flex flex-col gap-1">
			<li
				v-for="item in reasons"
				:key="item.member"
				class="text-p-sm text-ink-gray-6"
			>
				{{ item.member }}: {{ item.error }}
			</li>
		</ul>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { summaryLine } from '@/components/Enrollment/enrollment'
import type { BulkEnrollError, BulkEnrollResult } from '@/types'

const props = defineProps<{
	result: BulkEnrollResult
	skipped: BulkEnrollError[]
}>()

const reasons = computed<BulkEnrollError[]>(() => [
	...props.skipped,
	...props.result.errors,
])
</script>
