<template>
	<div class="space-y-4 rounded-6 border border-outline-gray-2 px-5 py-4">
		<div class="-mx-2 -my-0.5 flex flex-wrap items-center gap-2">
			<Select
				:modelValue="doc.paid_batch ? 'paid' : 'free'"
				:options="priceOptions"
				variant="ghost"
				:aria-label="__('Batch price')"
				class="w-24 shrink-0"
				@update:modelValue="(value) => setPaid(value === 'paid')"
			/>
			<PriceInput
				v-if="doc.paid_batch"
				:currency="doc.currency"
				:amount="doc.amount"
				:missing="form.isMissing('currency') || form.isMissing('amount')"
				class="min-w-0 flex-1 basis-40"
				@update:currency="(value) => (doc.currency = value)"
				@update:amount="(value) => (doc.amount = value)"
			/>
			<Button
				v-if="!doc.video_link"
				variant="ghost"
				icon="lucide-video"
				:label="__('Add preview video')"
				:tooltip="__('Add preview video')"
				class="ms-auto shrink-0"
				@click="showVideoDialog = true"
			/>
		</div>
		<div v-if="doc.video_link" class="group relative">
			<VideoPreview
				:video-link="doc.video_link"
				:fallback-image="doc.meta_image"
				class="rounded-5"
			/>
			<Button
				size="sm"
				icon="lucide-video"
				:label="__('Edit preview video')"
				:tooltip="__('Edit preview video')"
				class="absolute end-2 top-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
				@click="showVideoDialog = true"
			/>
		</div>
		<VideoLinkDialog
			v-model:open="showVideoDialog"
			:modelValue="doc.video_link"
			@update:modelValue="(link) => (doc.video_link = link || '')"
		/>
		<PaymentsAppDialog v-model="needsPaymentsApp" />
		<div>
			<Button v-if="buttonLabel" variant="solid" class="w-full" disabled>
				<template #prefix>
					<span
						class="size-4"
						:class="
							doc.paid_batch ? 'lucide-credit-card' : 'lucide-graduation-cap'
						"
					/>
				</template>
				{{ buttonLabel }}
			</Button>
			<p v-else class="text-center text-p-sm text-ink-gray-6">
				{{ message }}
			</p>
			<p v-if="closesLabel" class="mt-2 text-center text-p-sm text-ink-gray-6">
				{{ closesLabel }}
			</p>
			<p v-if="note" class="mt-1.5 text-center text-p-xs text-ink-gray-6">
				{{ note }}
			</p>
		</div>
		<!-- Tighter than the learner's 2.5: fields are taller than text rows. -->
		<div class="space-y-1.5 border-t border-outline-gray-1 pt-4">
			<div class="text-p-base-medium text-ink-gray-9">
				{{ __('This batch includes') }}
			</div>
			<BatchFactsEditor :doc="doc" :form="form" :courseCount="courseCount" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Select } from 'frappe-ui'
import PriceInput from '@/components/InlineEdit/PriceInput.vue'
import PaymentsAppDialog from '@/components/PaymentsAppDialog.vue'
import { usePaymentsApp } from '@/composables/usePaymentsApp'
import VideoLinkDialog from '@/components/InlineEdit/VideoLinkDialog.vue'
import VideoPreview from '@/components/VideoPreview.vue'
import BatchFactsEditor from '@/pages/Batches/components/overview/BatchFactsEditor.vue'
import type { BatchForm } from '@/pages/Batches/composables/useBatchForm'
import type { LMSBatch } from '@/types/lms/LMSBatch'
import { enrollmentClosesLabel } from '@/utils/batchEnrollment'

/** The enrol card as instructors edit it: the card learners see, row for row. */
const props = defineProps<{
	doc: LMSBatch
	form: BatchForm
	courseCount?: number
	/** From the saved batch: learners then see the closed message. */
	enrollmentClosed?: boolean
	/** From the saved batch: the last day of a late enrolment. */
	enrollmentClosesOn?: string
}>()

const showVideoDialog = ref(false)
const { needsPaymentsApp, canSell } = usePaymentsApp()

const priceOptions = [
	{ label: __('Free'), value: 'free' },
	{ label: __('Paid'), value: 'paid' },
]

// The form keeps checkboxes as booleans, so the dirty check sees no change
// after switching back.
const setPaid = (paid: boolean): void => {
	if (paid && !canSell()) return
	;(props.doc as Record<string, unknown>).paid_batch = paid
}

const buttonLabel = computed<string>(() => {
	if (props.enrollmentClosed) return ''
	if (props.doc.paid_batch) return __('Register Now')
	if (props.doc.allow_self_enrollment) return __('Enroll Now')
	return ''
})

const message = computed<string>(() =>
	props.enrollmentClosed
		? __('Enrollment for this batch is closed')
		: __('Contact the Administrator to enroll for this batch')
)

const closesLabel = computed<string>(() =>
	props.enrollmentClosed ? '' : enrollmentClosesLabel(props.enrollmentClosesOn)
)

const note = computed<string>(() => {
	if (props.enrollmentClosed || buttonLabel.value) return ''
	return __(
		'Self enrollment is off in Settings, so learners see this message and you enroll them.'
	)
})
</script>
