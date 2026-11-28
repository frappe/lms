<template>
	<div class="motion-safe:animate-pulse" aria-hidden="true">
		<div
			v-if="!rows"
			class="flex flex-col items-center gap-2 rounded-6 border border-dashed border-outline-gray-3 px-6 py-8"
		>
			<div class="size-12 rounded-full bg-surface-gray-2" />
			<SkeletonText
				text="text-base-semibold"
				width="w-40"
				class="w-40"
				strong
			/>
			<SkeletonText width="w-80" class="w-80 max-w-full" />
			<div class="mt-2 h-7 w-32 rounded-4 bg-surface-gray-2" />
		</div>
		<div
			v-else-if="row === 'schedule'"
			class="divide-y divide-outline-gray-1 rounded-5 border border-outline-gray-2"
		>
			<div
				v-for="i in rows"
				:key="i"
				class="flex items-center gap-4 px-4 py-2.5 text-p-base"
			>
				<SkeletonText width="w-20" class="w-24 shrink-0" />
				<SkeletonText text="" width="w-1/2" class="flex-1" />
			</div>
		</div>
		<div v-else class="rounded-5 border border-outline-gray-2 p-2">
			<template v-if="row === 'course'">
				<div
					v-for="i in rows"
					:key="i"
					class="flex items-center gap-3 px-2 py-2"
				>
					<div class="size-10 shrink-0 rounded-3 bg-surface-gray-2" />
					<div class="min-w-0 flex-1">
						<SkeletonText text="text-p-base-medium" width="w-1/2" strong />
						<SkeletonText width="w-16" />
					</div>
				</div>
			</template>
			<template v-else>
				<div
					v-for="i in rows"
					:key="i"
					class="flex h-10 items-center gap-3 px-2"
				>
					<div class="size-4 shrink-0 rounded-4 bg-surface-gray-2" />
					<SkeletonText text="text-p-base" width="w-1/2" class="flex-1" />
				</div>
			</template>
			<div v-if="footer" class="px-1 pt-1">
				<div class="h-7 w-32 rounded-4 bg-surface-gray-2" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/**
 * The body of a batch overview section (pages/Batches/components/overview):
 * its bordered list, or its dashed empty tile when `rows` is 0.
 */
withDefaults(
	defineProps<{
		rows: number
		row?: 'course' | 'line' | 'schedule'
		/** The list's own "Add …" button row. */
		footer?: boolean
	}>(),
	{ row: 'line', footer: false }
)
</script>
