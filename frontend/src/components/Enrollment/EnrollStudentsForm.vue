<template>
	<FormShell
		:title="__('Enroll Students')"
		size="4xl"
		position="top"
		@close="onClose"
	>
		<div
			data-testid="enroll-body"
			class="flex flex-col gap-5"
			:class="isMobile ? 'h-full' : 'h-[min(32rem,calc(80dvh-17rem))]'"
		>
			<div v-if="loading" class="text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div v-else-if="refusal" class="text-p-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<template v-else-if="target">
				<Stepper
					v-if="paid"
					:modelValue="step"
					:steps="steps"
					:completed="!!result"
					:clickable="!submitting"
					@update:modelValue="goTo"
				/>
				<div
					ref="stepContent"
					data-testid="enroll-step-content"
					role="group"
					tabindex="-1"
					:aria-label="stepLabel"
					class="min-h-0 flex-1 outline-none"
					:class="
						step === 'select' && !result ? 'overflow-hidden' : 'overflow-y-auto'
					"
				>
					<EnrollSummary v-if="result" :result="result" :skipped="skipped" />
					<EnrollSelectStep
						v-else-if="step === 'select'"
						v-model:members="members"
						v-model:paid="paid"
						:target="target"
					/>
					<EnrollPaymentStep
						v-else-if="step === 'payments'"
						v-model:defaults="defaults"
						v-model:choices="choices"
						v-model:overrides="overrides"
						v-model:panelOpen="panelOpen"
						:rows="enrollableRows"
					/>
					<EnrollReviewStep
						v-else
						:rows="enrollableRows"
						:seatsLeft="seatsLeft"
						:loading="preview.loading"
						:paid="paid"
						:certificate="target.paidKind === 'certificate'"
						:paymentLabels="paymentLabels"
						@remove="remove"
					/>
				</div>
			</template>
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
						v-if="paid"
						data-testid="enroll-next"
						:label="__('Next')"
						variant="solid"
						:loading="preview.loading"
						:disabled="!members.length || preview.loading"
						@click="leaveSelect"
					/>
					<HeaderButton
						v-else
						data-testid="enroll-submit"
						:label="enrollButtonLabel(members.length)"
						variant="solid"
						:loading="submitting"
						:disabled="!canEnroll || submitting"
						@click="enroll"
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
						v-if="step === 'payments'"
						data-testid="enroll-next"
						:label="__('Next')"
						variant="solid"
						:disabled="!paymentsReady"
						@click="step = 'review'"
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
	effectivePayment,
	emptyAddress,
	enrollButtonLabel,
	exceedsSeats,
	isEnrollable,
	normalizeResult,
	paidByDefault,
	paymentSummary,
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
	PaymentOverride,
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
const paid = ref<boolean>(false)
const defaults = ref<PaymentDefaults>({
	amount: null,
	currency: null,
	source: null,
	address: emptyAddress(),
})
const choices = ref<Record<string, PaymentChoice>>({})
const overrides = ref<Record<string, PaymentOverride>>({})
const rows = ref<EnrollPreviewRow[]>([])
const seatsLeft = ref<number | null>(null)
const result = ref<BulkEnrollResult | null>(null)
const panelOpen = ref<boolean>(false)
const stepContent = ref<HTMLElement | null>(null)
const { isMobile } = useScreenSize()

watch(
	() => props.target?.paidKind,
	(kind, previous) => {
		if (kind !== undefined && previous === undefined) {
			paid.value = paidByDefault(kind)
		}
	},
	{ immediate: true }
)

const steps = computed<StepItem[]>(() => [
	{ value: 'select', label: __('Select') },
	{ value: 'payments', label: __('Payments') },
	{ value: 'review', label: __('Review') },
])

const stepLabel = computed<string>(() => {
	if (result.value) return __('Summary')
	return steps.value.find((item) => item.value === step.value)?.label ?? ''
})

watch(step, () => {
	panelOpen.value = false
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

const skipped = computed<BulkEnrollError[]>(() => {
	if (!paid.value) return []
	return rows.value
		.filter((row) => !isEnrollable(row.status))
		.map((row) => ({ member: row.member, error: statusLabel(row.status) }))
})

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

const paymentsReady = computed<boolean>(() =>
	canSubmitPayments(
		defaults.value,
		enrollableMembers.value,
		choices.value,
		overrides.value
	)
)

const submitMembers = computed<string[]>(() =>
	paid.value ? enrollableMembers.value : members.value
)

const canEnroll = computed<boolean>(() => {
	if (!paid.value) return members.value.length > 0
	return (
		!preview.loading &&
		enrollableRows.value.length > 0 &&
		!exceedsSeats(rows.value, seatsLeft.value) &&
		paymentsReady.value
	)
})

const paymentLabels = computed<Record<string, string>>(() => {
	const labels: Record<string, string> = {}
	for (const member of enrollableMembers.value) {
		labels[member] = paymentSummary(
			choices.value[member],
			effectivePayment(defaults.value, overrides.value[member] ?? null)
		)
	}
	return labels
})

const isStep = (value: StepValue): value is EnrollStep =>
	value === 'select' || value === 'review' || value === 'payments'

const goTo = (value: StepValue) => {
	if (!submitting.value && isStep(value)) step.value = value
}

const back = () => {
	if (submitting.value) return
	step.value = step.value === 'review' ? 'payments' : 'select'
}

const onClose = () => {
	if (isMobile.value && panelOpen.value && step.value === 'payments') {
		panelOpen.value = false
		return
	}
	if (isMobile.value && !result.value && step.value !== 'select') {
		back()
		return
	}
	emit('close')
}

const keepsChoice = (
	choice: PaymentChoice | undefined,
	row: EnrollPreviewRow
): boolean => {
	if (!choice) return false
	if (choice.mode === 'create') return true
	const offered = row.linkable_payments.map((payment) => payment.name)
	return choice.payment ? offered.includes(choice.payment) : !!offered.length
}

const seedPayments = (data: EnrollPreview) => {
	if (defaults.value.amount === null && defaults.value.currency === null) {
		defaults.value = {
			...defaults.value,
			amount: data.amount,
			currency: data.currency,
		}
	}
	const seeded = { ...choices.value }
	for (const row of data.rows) {
		if (!keepsChoice(seeded[row.member], row)) {
			seeded[row.member] = { mode: 'create' }
		}
	}
	choices.value = seeded
}

const leaveSelect = () => {
	const target = props.target
	if (!target || !paid.value || !members.value.length || preview.loading) return
	submitResource(
		preview,
		{
			doctype: target.doctype,
			docname: target.name,
			members: JSON.stringify(members.value),
			purchased_certificate: target.paidKind === 'certificate',
		},
		{
			onSuccess(data) {
				if (!data) return
				rows.value = data.rows
				seatsLeft.value = data.seats_left
				seedPayments(data)
				step.value = 'payments'
			},
			onError(err: FrappeResourceError) {
				toast.error(resourceErrorMessage(err, __('Could not load students')))
			},
		}
	)
}

const remove = (removed: string[]) => {
	const gone = new Set(removed)
	members.value = members.value.filter((item) => !gone.has(item))
	rows.value = rows.value.filter((row) => !gone.has(row.member))
	const keptChoices = { ...choices.value }
	const keptOverrides = { ...overrides.value }
	for (const member of gone) {
		delete keptChoices[member]
		delete keptOverrides[member]
	}
	choices.value = keptChoices
	overrides.value = keptOverrides
}

const enroll = () => {
	const target = props.target
	if (!target || submitting.value || !canEnroll.value) return
	const resource = target.doctype === 'LMS Course' ? courseSubmit : batchSubmit
	submitResource(
		resource,
		buildSubmitParams(
			target,
			submitMembers.value,
			paid.value,
			defaults.value,
			choices.value,
			overrides.value
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
