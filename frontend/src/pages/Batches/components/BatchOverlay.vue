<template>
	<div
		v-if="batch.data"
		class="space-y-4 rounded-6 border border-outline-gray-2 px-5 py-4"
	>
		<div class="flex items-center justify-between gap-2">
			<span class="text-xl-semibold text-ink-gray-9">
				{{
					batch.data.paid_batch && batch.data.amount
						? formatNumberIntoCurrency(batch.data.amount, batch.data.currency)
						: __('Free')
				}}
			</span>
			<Badge
				v-if="batch.data.seat_count && batch.data.seats_left > 0"
				theme="green"
				:label="
					batch.data.seats_left > 1
						? __('{0} seats left').format(batch.data.seats_left)
						: __('1 seat left')
				"
			/>
			<Badge
				v-else-if="batch.data.seat_count && batch.data.seats_left <= 0"
				theme="red"
				:label="__('Sold Out')"
			/>
		</div>

		<VideoPreview
			:video-link="batch.data.video_link"
			:fallback-image="batch.data.meta_image"
			class="rounded-5"
		/>

		<div v-if="!readOnlyMode && !canAccessBatch">
			<Button
				v-if="
					batch.data.paid_batch && hasSeatsLeft && batch.data.accept_enrollments
				"
				class="w-full"
				variant="solid"
				:route="preview ? undefined : billingRoute"
				@click="preview?.enroll()"
			>
				<template #prefix>
					<span class="lucide-credit-card size-4" />
				</template>
				{{ __('Register Now') }}
			</Button>
			<Button
				v-else-if="
					batch.data.allow_self_enrollment &&
					hasSeatsLeft &&
					batch.data.accept_enrollments
				"
				variant="solid"
				class="w-full"
				:loading="enroll.loading"
				@click="enrollInBatch()"
			>
				<template #prefix>
					<span class="lucide-graduation-cap size-4" />
				</template>
				{{ __('Enroll Now') }}
			</Button>
			<p
				v-else-if="!batch.data.accept_enrollments"
				class="text-center text-p-sm text-ink-gray-6"
			>
				{{ __('Enrollment for this batch is closed') }}
			</p>
			<p v-else-if="hasSeatsLeft" class="text-center text-p-sm text-ink-gray-6">
				{{ __('Contact the Administrator to enroll for this batch') }}
			</p>
			<p
				v-if="closesLabel && batch.data.accept_enrollments && hasSeatsLeft"
				class="mt-2 text-center text-p-sm text-ink-gray-6"
			>
				{{ closesLabel }}
			</p>
		</div>
		<Button v-else-if="isStudent" variant="subtle" class="w-full" disabled>
			<template #prefix>
				<span class="lucide-check size-4" />
			</template>
			{{ __('You’re enrolled') }}
		</Button>

		<div class="space-y-2.5 border-t border-outline-gray-1 pt-4">
			<div class="text-p-base-medium text-ink-gray-9">
				{{ __('This batch includes') }}
			</div>
			<BatchFacts :batch="batch.data" />
		</div>
	</div>
</template>
<script setup>
import { inject, computed } from 'vue'
import { Badge, Button, createResource, toast } from 'frappe-ui'
import { formatNumberIntoCurrency } from '@/utils'
import { redirectToLogin } from '@/utils/login'
import VideoPreview from '@/components/VideoPreview.vue'
import { enrollmentClosesLabel } from '@/utils/batchEnrollment'
import BatchFacts from '@/pages/Batches/components/overview/BatchFacts.vue'
import { useStudentView } from '@/composables/useStudentView'
import { injectBatchPreview } from '@/pages/Batches/composables/batchStudentView'

const user = inject('$user')
const readOnlyMode = window.read_only_mode
const isStudentView = useStudentView()
const batchPreview = injectBatchPreview()

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})

/** Set while an instructor previews: enrolling only switches the preview. */
const closesLabel = computed(() =>
	enrollmentClosesLabel(props.batch.data?.enrollment_closes_on)
)

const preview = computed(() => (isStudentView.value ? batchPreview : null))

const billingRoute = computed(() => ({
	name: 'Billing',
	params: { type: 'batch', name: props.batch.data.name },
}))

const enroll = createResource({
	url: 'lms.lms.utils.enroll_in_batch',
	makeParams() {
		return {
			batch: props.batch.data.name,
		}
	},
})

const enrollInBatch = () => {
	if (enroll.loading) return
	if (preview.value) {
		preview.value.enroll()
		return
	}
	if (!user.data) {
		redirectToLogin()
		return
	}
	enroll.submit(
		{},
		{
			onSuccess() {
				toast.success(__('You have been enrolled in this batch'))
				// Refetch the batch: once `students` includes the user, BatchDetail
				// swaps the enroll view for the enrolled one reactively.
				props.batch.reload()
			},
			onError(err) {
				toast.error(__(err.messages?.[0] || err))
				console.error(err)
			},
		}
	)
}

const hasSeatsLeft = computed(() => {
	return !props.batch.data?.seat_count || props.batch.data.seats_left > 0
})

const isStudent = computed(() => {
	return user.data ? Boolean(props.batch.data?.is_student) : false
})

const canAccessBatch = computed(() => {
	if (!user.data) {
		return false
	}
	// can_manage is per-batch: a Course Creator only manages a batch they are
	// tagged an instructor/evaluator on, unlike the global moderator/evaluator.
	return (
		user.data?.is_moderator ||
		isStudent.value ||
		user.data?.is_evaluator ||
		Boolean(props.batch.data?.can_manage)
	)
})
</script>
