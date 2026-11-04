<template>
	<AssessmentCard
		class="flex h-full flex-col"
		aria-busy="true"
		data-testid="exercise-skeleton"
	>
		<AssessmentCardHeader icon="lucide-code-xml" :title="title">
			<Skeleton class="h-7 w-14 rounded-4" />
			<Skeleton class="h-7 w-20 rounded-4" />
		</AssessmentCardHeader>

		<div
			class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
		>
			<div
				class="flex min-h-0 flex-col border-b border-outline-gray-1 md:border-b-0 md:border-e"
			>
				<div
					class="flex h-11 shrink-0 items-center gap-x-4 bg-surface-gray-1 px-3.5"
				>
					<Skeleton class="h-4 w-14 rounded-4" />
					<Skeleton class="h-4 w-20 rounded-4" />
				</div>
				<div class="space-y-2.5 p-3.5">
					<Skeleton class="h-4 w-full rounded-4" />
					<Skeleton class="h-4 w-11/12 rounded-4" />
					<Skeleton class="h-4 w-4/5 rounded-4" />
					<Skeleton class="h-4 w-2/3 rounded-4" />
				</div>
			</div>

			<div class="flex min-h-0 flex-col">
				<div
					class="flex h-11 shrink-0 items-center justify-between gap-x-2 border-b border-outline-gray-1 bg-surface-gray-1 px-3"
				>
					<Skeleton class="h-3.5 w-20 rounded-4" />
					<Skeleton class="h-3.5 w-24 rounded-4" />
				</div>
				<div class="min-h-[16rem] flex-1 space-y-2.5 p-3.5">
					<Skeleton class="h-4 w-3/5 rounded-4" />
					<Skeleton class="h-4 w-2/5 rounded-4" />
					<Skeleton class="h-4 w-1/2 rounded-4" />
				</div>
				<div
					class="flex min-h-0 flex-1 flex-col border-t border-outline-gray-1"
				>
					<div class="flex h-10 shrink-0 items-center px-3">
						<Skeleton class="h-4 w-20 rounded-4" />
					</div>
				</div>
			</div>
		</div>
	</AssessmentCard>
</template>

<script setup lang="ts">
import { Skeleton } from 'frappe-ui'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'

const title = __('Programming Exercise')
</script>
