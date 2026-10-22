<template>
	<FormShell
		:title="__('Enroll Students')"
		size="2xl"
		position="top"
		@close="onClose"
	>
		<div v-if="loading" class="text-base text-ink-gray-6">
			{{ __('Loading...') }}
		</div>
		<div v-else-if="refusal" class="text-p-base text-ink-gray-6">
			{{ refusal }}
		</div>
		<div v-else-if="target" class="flex flex-col gap-5">
			<Stepper
				:modelValue="step"
				:steps="steps"
				:completed="!!result"
				:clickable="!submitting"
				@update:modelValue="goTo"
			/>
			<div
				ref="stepContent"
				data-testid="enroll-step-content"
				tabindex="-1"
				:aria-label="stepLabel"
				class="outline-none"
			>
				<EnrollSummary v-if="result" :result="result" :skipped="skipped" />
				<EnrollSelectStep
					v-else-if="step === 'select'"
					v-model:members="members"
					v-model:paid="paid"
					:target="target"
				/>
				<EnrollReviewStep
					v-else-if="step === 'review'"
					:rows="rows"
					:seatsLeft="seatsLeft"
					:loading="preview.loading"
					@remove="remove"
				/>
				<EnrollPaymentStep
					v-else
					v-model:defaults="defaults"
					v-model:choices="choices"
					:rows="enrollableRows"
				/>
			</div>
		</div>
		<template #actions>
			<div
				v-if="target && !refusal && !loading"
				data-testid="enroll-footer"
				class="flex w-full items-center justify-between gap-2"
			>
				<template v-if="result">
					<span />
					<HeaderButton
						data-testid="enroll-done"
						:label="__('Done')"
						variant="solid"
						@click="emit('close')"
					/>
				</template>
				<template v-else-if="step === 'select'">
					<span class="text-sm text-ink-gray-6" aria-live="polite">
						{{ __('{0} selected', [members.length]) }}
					</span>
					<HeaderButton
						data-testid="enroll-next"
						:label="__('Next')"
						variant="solid"
						:disabled="!members.length || preview.loading"
						@click="toReview"
					/>
				</template>
				<template v-else>
					<HeaderButton
						data-testid="enroll-back"
						:label="__('Back')"
						:disabled="submitting"
						@click="back"
					/>
					<HeaderButton
						v-if="step === 'review' && paid"
						data-testid="enroll-next"
						:label="__('Next')"
						variant="solid"
						:disabled="!canLeaveReview"
						@click="step = 'payments'"
					/>
					<HeaderButton
						v-else
						data-testid="enroll-submit"
						:label="enrollButtonLabel(enrollableRows.length)"
						variant="solid"
						:loading="submitting"
						:disabled="!canEnroll"
						@click="enroll"
					/>
				</template>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import { createResource, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { computed, nextTick, ref, watch } from 'vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { Stepper } from '@/components/Stepper'
import type { StepItem, StepValue } from '@/components/Stepper'
import EnrollPaymentStep from '@/components/Enrollment/EnrollPaymentStep.vue'
import EnrollReviewStep from '@/components/Enrollment/EnrollReviewStep.vue'
import EnrollSelectStep from '@/components/Enrollment/EnrollSelectStep.vue'
import EnrollSummary from '@/components/Enrollment/EnrollSummary.vue'
import {
	buildSubmitParams,
	canSubmitPayments,
	enrollButtonLabel,
	exceedsSeats,
	isEnrollable,
	normalizeResult,
	statusLabel,
} from '@/components/Enrollment/enrollment'
import type {
	BulkEnrollError,
	BulkEnrollResult,
	EnrollPreview,
	EnrollPreviewRow,
	EnrollStep,
	EnrollTarget,
	PaymentChoice,
	PaymentDefaults,
	Resource,
} from '@/types'
import { useScreenSize } from '@/utils/composables'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

type RawResult = Parameters<typeof normalizeResult>[0]

const props = defineProps<{
	target: EnrollTarget | null
	refusal: string
	loading: boolean
}>()

const emit = defineEmits<{
	close: []
	enrolled: [result: BulkEnrollResult]
}>()

const step = ref<EnrollStep>('select')
const members = ref<string[]>([])
const paid = ref(false)
const defaults = ref<PaymentDefaults>({
	amount: null,
	currency: null,
	source: null,
})
const choices = ref<Record<string, PaymentChoice>>({})
const rows = ref<EnrollPreviewRow[]>([])
const seatsLeft = ref<number | null>(null)
const result = ref<BulkEnrollResult | null>(null)
const stepContent = ref<HTMLElement | null>(null)
const { isMobile } = useScreenSize()

const steps = computed<StepItem[]>(() => {
	const items: StepItem[] = [
		{ value: 'select', label: __('Select') },
		{ value: 'review', label: __('Review') },
	]
	if (paid.value) items.push({ value: 'payments', label: __('Payments') })
	return items
})

const stepLabel = computed<string>(() => {
	if (result.value) return __('Summary')
	return steps.value.find((item) => item.value === step.value)?.label ?? ''
})

watch([step, result], async () => {
	await nextTick()
	stepContent.value?.focus()
})

const enrollableRows = computed<EnrollPreviewRow[]>(() =>
	rows.value.filter((row) => isEnrollable(row.status))
)

const enrollableMembers = computed<string[]>(() =>
	enrollableRows.value.map((row) => row.member)
)

const skipped = computed<BulkEnrollError[]>(() =>
	rows.value
		.filter((row) => !isEnrollable(row.status))
		.map((row) => ({ member: row.member, error: statusLabel(row.status) }))
)

const preview = createResource({
	url: 'lms.lms.api.get_bulk_enrollment_preview',
}) as unknown as Resource<EnrollPreview | null>

const courseSubmit = createResource({
	url: 'lms.lms.api.enroll_students_in_course',
}) as unknown as Resource<RawResult>

const batchSubmit = createResource({
	url: 'lms.lms.api.add_students_to_batch',
}) as unknown as Resource<RawResult>

const submitting = computed<boolean>(
	() => courseSubmit.loading || batchSubmit.loading
)

const canLeaveReview = computed<boolean>(
	() =>
		!preview.loading &&
		enrollableRows.value.length > 0 &&
		!exceedsSeats(rows.value, seatsLeft.value)
)

const canEnroll = computed<boolean>(() => {
	if (!canLeaveReview.value) return false
	if (!paid.value) return true
	return canSubmitPayments(
		defaults.value,
		enrollableMembers.value,
		choices.value
	)
})

const isStep = (value: StepValue): value is EnrollStep =>
	value === 'select' || value === 'review' || value === 'payments'

const goTo = (value: StepValue) => {
	if (!submitting.value && isStep(value)) step.value = value
}

const back = () => {
	if (submitting.value) return
	step.value = step.value === 'payments' ? 'review' : 'select'
}

const onClose = () => {
	if (isMobile.value && !result.value && step.value !== 'select') {
		back()
		return
	}
	emit('close')
}

const seedPayments = (data: EnrollPreview) => {
	if (defaults.value.amount === null && defaults.value.currency === null) {
		defaults.value = {
			amount: data.amount,
			currency: data.currency,
			source: null,
		}
	}
	const seeded = { ...choices.value }
	for (const row of data.rows) {
		seeded[row.member] ??= { mode: 'create' }
	}
	choices.value = seeded
}

const toReview = () => {
	const target = props.target
	if (!target || !members.value.length) return
	rows.value = []
	seatsLeft.value = null
	step.value = 'review'
	submitResource(
		preview,
		{
			doctype: target.doctype,
			docname: target.name,
			members: JSON.stringify(members.value),
			purchased_certificate: paid.value && target.paidKind === 'certificate',
		},
		{
			onSuccess(data) {
				if (!data) return
				rows.value = data.rows
				seatsLeft.value = data.seats_left
				seedPayments(data)
			},
			onError(err: FrappeResourceError) {
				step.value = 'select'
				toast.error(resourceErrorMessage(err, __('Could not load students')))
			},
		}
	)
}

const remove = (member: string) => {
	members.value = members.value.filter((item) => item !== member)
	rows.value = rows.value.filter((row) => row.member !== member)
	const rest = { ...choices.value }
	delete rest[member]
	choices.value = rest
}

const enroll = () => {
	const target = props.target
	if (!target || submitting.value || !canEnroll.value) return
	const resource = target.doctype === 'LMS Course' ? courseSubmit : batchSubmit
	submitResource(
		resource,
		buildSubmitParams(
			target,
			enrollableMembers.value,
			paid.value,
			defaults.value,
			choices.value
		),
		{
			onSuccess(data) {
				result.value = normalizeResult(data)
				emit('enrolled', result.value)
			},
			onError(err: FrappeResourceError) {
				toast.error(resourceErrorMessage(err, __('Could not enroll students')))
			},
		}
	)
}
</script>
