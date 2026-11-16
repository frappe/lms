<template>
	<ChartCard class="flex flex-col [&_[data-slot=chart-plot]]:pb-0">
		<ChartContainer
			:title="__('Rating')"
			:loading="!feedback"
			:empty="!reviews"
			:class="{ 'min-h-24': !reviews }"
		>
			<template #loading>
				<PanelSkeleton kind="rows" :rows="1" />
			</template>
			<template #actions>
				<Button
					v-if="reviews"
					size="sm"
					variant="ghost"
					:label="__('View all')"
					@click="openDialog()"
				/>
			</template>
			<template #empty>
				<span class="text-p-sm text-ink-gray-6">{{
					__('No reviews yet')
				}}</span>
			</template>
			<div v-if="feedback && reviews" class="flex h-full flex-col gap-3">
				<RatingSummary
					class="shrink-0"
					:average="feedback.average"
					:reviews="reviews"
				/>
				<FeedbackComments
					:rows="feedback.latest"
					:label="__('Latest reviews')"
					@select="openDialog"
				/>
			</div>
		</ChartContainer>
		<FeedbackModal
			v-if="feedback"
			v-model="showDialog"
			:config="modalConfig"
			:summary="feedback"
			:initial-response="initialResponse"
		/>
	</ChartCard>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'
import { ChartCard, ChartContainer } from 'frappe-ui/charts'
import { computed, ref } from 'vue'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'
import FeedbackComments from '@/components/FeedbackComments.vue'
import FeedbackModal from '@/components/Modals/FeedbackModal.vue'
import RatingSummary from '@/components/RatingSummary.vue'
import { courseFeedbackConfig } from '@/utils/dashboard/feedback'
import type { CourseFeedbackSummary } from '@/types'

const props = defineProps<{
	courseName: string
	feedback: CourseFeedbackSummary | null
}>()

const showDialog = ref<boolean>(false)
const initialResponse = ref<string | null>(null)

const reviews = computed<number>(() => props.feedback?.responses ?? 0)

const modalConfig = computed(() =>
	courseFeedbackConfig(props.courseName, props.feedback!)
)

const openDialog = (name: string | null = null): void => {
	initialResponse.value = name
	showDialog.value = true
}
</script>
