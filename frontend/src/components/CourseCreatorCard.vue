<template>
	<div class="border-2 rounded-md p-5 bg-surface-cards border-outline-gray-2">
		<div
			class="uppercase text-ink-gray-5 text-xs font-semibold tracking-wider mb-4"
		>
			{{ __('Course creator') }}
		</div>

		<div class="flex items-center gap-3">
			<div class="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
				ES
			</div>
			<div class="min-w-0">
				<div class="font-medium text-ink-gray-9 truncate">
					Ecological Society
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { CourseInstructorInfo } from '@/types/api'

defineProps<{
	instructors?: CourseInstructorInfo[]
}>()
</script>
