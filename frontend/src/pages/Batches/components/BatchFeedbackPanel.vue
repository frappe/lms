<template>
	<ChartCard class="flex flex-col [&_[data-slot=chart-plot]]:pb-0">
		<ChartContainer
			:title="__('Feedback')"
			:subtitle="responsesText"
			:loading="!feedback"
			:empty="!responses"
			:class="{ 'min-h-24': !responses }"
		>
			<template #loading>
				<PanelSkeleton kind="rows" :rows="3" />
			</template>
			<template #actions>
				<Button
					v-if="responses"
					size="sm"
					variant="ghost"
					:label="__('View all')"
					@click="openDialog()"
				/>
			</template>
			<template #empty>
				<span class="text-p-sm text-ink-gray-6">{{
					__('No feedback yet')
				}}</span>
			</template>
			<div v-if="feedback && responses" class="flex h-full flex-col gap-3">
				<dl class="flex shrink-0 flex-col gap-1.5">
					<div
						v-for="key in RATING_KEYS"
						:key="key"
						class="flex items-center gap-3"
					>
						<dt class="min-w-0 flex-1 truncate text-sm text-ink-gray-7">
							{{ ratingLabel(key) }}
						</dt>
						<dd class="flex items-center gap-2">
							<Rating
								:model-value="feedback.averages[key]"
								:step="0.5"
								:disabled="true"
								aria-hidden="true"
							/>
							<span
								class="w-7 text-end text-sm-semibold tabular-nums text-ink-gray-8"
							>
								{{ formatAverage(feedback.averages[key]) }}
							</span>
						</dd>
					</div>
				</dl>
				<FeedbackComments
					:rows="feedback.latest"
					:label="__('Latest comments')"
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
import { Button, Rating } from 'frappe-ui'
import { ChartCard, ChartContainer } from 'frappe-ui/charts'
import { computed, ref } from 'vue'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'
import FeedbackComments from '@/components/FeedbackComments.vue'
import FeedbackModal from '@/components/Modals/FeedbackModal.vue'
import {
	batchFeedbackConfig,
	RATING_KEYS,
	ratingLabel,
} from '@/utils/dashboard/feedback'
import type { FeedbackSummary } from '@/types'

const props = defineProps<{
	batchName: string
	feedback: FeedbackSummary | null
}>()

const showDialog = ref<boolean>(false)
const initialResponse = ref<string | null>(null)

const responses = computed<number>(() => props.feedback?.responses ?? 0)

const responsesText = computed<string | undefined>(() => {
	if (!responses.value) return undefined
	return responses.value === 1
		? __('Average of 1 response')
		: __('Average of {0} responses').format(responses.value.toLocaleString())
})

const modalConfig = computed(() =>
	batchFeedbackConfig(props.batchName, props.feedback!)
)

// A blank average reads as a dash, not as 0.0 stars.
const formatAverage = (value: number): string =>
	value ? value.toFixed(1) : '–'

const openDialog = (name: string | null = null): void => {
	initialResponse.value = name
	showDialog.value = true
}
</script>
