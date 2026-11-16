<template>
	<FormShell
		:title="__('Enroll Students')"
		size="4xl"
		position="top"
		@close="onClose"
	>
		<DefinePanel>
			<EnrollPaymentPanel
				ref="panelRef"
				:key="panelKey"
				v-model:defaults="defaults"
				v-model:choices="choices"
				v-model:overrides="overrides"
				:rows="panelRows"
				:common="editsCommon"
				:commonAddressUsed="commonAddressUsed"
				:total="visibleMembers.length"
				:showBack="isMobile"
				:flagMissing="flagMissing"
				@close="closePanel"
				@back="closePanel"
			/>
		</DefinePanel>
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
			<div
				v-else-if="target"
				data-testid="enroll-content"
				role="group"
				tabindex="-1"
				:aria-label="__('Enroll Students')"
				class="-mx-3 flex min-h-0 flex-1 gap-6 overflow-hidden px-3 outline-none"
			>
				<div
					v-if="!isMobile || !panelShown"
					data-testid="enroll-main"
					class="flex min-h-0 min-w-0 flex-1 flex-col"
				>
					<EnrollSelectStep
						v-model:members="members"
						v-model:paid="paid"
						v-model:checking="checking"
						:target="target"
					>
						<template #list="{ students, remove }">
							<div
								data-testid="enroll-list-row"
								class="flex min-h-0 flex-1 gap-4"
							>
								<div
									data-testid="enroll-list"
									class="flex min-h-0 min-w-0 flex-1 flex-col"
								>
									<ErrorMessage
										v-if="seatsMessage"
										class="mb-2"
										:message="seatsMessage"
									/>
									<EnrollStudentTable
										v-model:ticked="ticked"
										:rows="tableRows(students)"
										:paid="paid"
										:compact="panelShown || isMobile"
										@remove="remove"
										@reset="resetDetails"
									/>
								</div>
								<div
									v-if="panelShown"
									data-testid="payment-panel"
									class="min-h-0 w-72 shrink-0 border-s border-outline-gray-1 ps-4"
								>
									<ReusePanel />
								</div>
							</div>
						</template>
					</EnrollSelectStep>
				</div>
				<div v-else data-testid="payment-panel" class="min-h-0 w-full">
					<ReusePanel />
				</div>
			</div>
		</div>
		<template #actions>
			<div
				v-if="target && !refusal && !loading"
				data-testid="enroll-footer"
				class="flex w-full items-center justify-between gap-2"
			>
				<span
					data-testid="enroll-status"
					class="min-w-0 truncate text-sm text-ink-gray-6"
					aria-live="polite"
				>
					{{ statusText }}
				</span>
				<div class="flex shrink-0 items-center gap-2">
					<HeaderButton
						v-if="detailsLabel && !detailsFirst"
						data-testid="enroll-details"
						:label="detailsLabel"
						:variant="paymentsReady ? 'outline' : 'solid'"
						@click="openDetails"
					/>
					<Tooltip :text="disabledReason">
						<span
							data-testid="enroll-primary"
							class="inline-flex"
							:tabindex="disabledReason ? 0 : undefined"
							:aria-describedby="disabledReason ? reasonId : undefined"
						>
							<HeaderButton
								:data-testid="detailsFirst ? 'enroll-details' : 'enroll-submit'"
								:label="
									detailsFirst
										? detailsLabel
										: enrollButtonLabel(submitMembers.length)
								"
								variant="solid"
								:loading="!detailsFirst && submitting"
								:disabled="!detailsFirst && (!canEnroll || submitting)"
								@click="detailsFirst ? openDetails() : enroll()"
							/>
						</span>
					</Tooltip>
					<span
						v-if="disabledReason"
						:id="reasonId"
						data-testid="enroll-reason"
						class="sr-only"
					>
						{{ disabledReason }}
					</span>
				</div>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { ErrorMessage, Tooltip, createResource, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { computed, nextTick, ref, useId, watch } from 'vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import EnrollPaymentPanel from '@/components/Enrollment/EnrollPaymentPanel.vue'
import EnrollSelectStep from '@/components/Enrollment/EnrollSelectStep.vue'
import EnrollStudentTable from '@/components/Enrollment/EnrollStudentTable.vue'
import {
	addressSummary,
	buildSubmitParams,
	canSubmitPayments,
	effectivePayment,
	enrollButtonLabel,
	enrollOutcome,
	exceedsSeats,
	hasAddress,
	hasOwnDetails,
	isEnrollable,
	listPaymentLabel,
	missingKeyLabel,
	missingPaymentDetails,
	missingPaymentKeys,
	normalizeResult,
	paidByDefault,
	paymentTotal,
	resetPaymentDetails,
	studentCountLabel,
} from '@/components/Enrollment/enrollment'
import type { MissingKey } from '@/components/Enrollment/enrollment'
import type {
	BulkEnrollResult,
	EnrollPreview,
	EnrollPreviewRow,
	EnrollTarget,
	PaymentChoice,
	PaymentDefaults,
	PaymentOverride,
	Resource,
	StudentOption,
	StudentRow,
} from '@/types'
import { useScreenSize } from '@/utils/composables'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

type RawResult = Parameters<typeof normalizeResult>[0]

const [DefinePanel, ReusePanel] = createReusableTemplate()

const props = defineProps<{
	target: EnrollTarget | null
	refusal: string
	loading: boolean
}>()

const emit = defineEmits<{
	close: []
	enrolled: [result: BulkEnrollResult]
}>()

const members = ref<string[]>([])
const paid = ref<boolean>(false)
const checking = ref<boolean>(false)
const defaults = ref<PaymentDefaults>({
	amount: null,
	currency: null,
	source: null,
	address: null,
})
const choices = ref<Record<string, PaymentChoice>>({})
const overrides = ref<Record<string, PaymentOverride>>({})
const rows = ref<EnrollPreviewRow[]>([])
const seatsLeft = ref<number | null>(null)
const panelOpen = ref<boolean>(false)
const ticked = ref<string[]>([])
const previewLoading = ref<boolean>(false)
const { isMobile } = useScreenSize()

const NONE = '—'

watch(
	() => props.target?.paidKind,
	(kind, previous) => {
		if (kind !== undefined && previous === undefined) {
			paid.value = paidByDefault(kind)
		}
	},
	{ immediate: true }
)

const keyOf = (member: string): string => member.toLowerCase()

const rowByMember = computed<Map<string, EnrollPreviewRow>>(
	() => new Map(rows.value.map((row) => [keyOf(row.member), row]))
)

const rowOf = (member: string): EnrollPreviewRow =>
	rowByMember.value.get(keyOf(member)) ?? {
		member,
		full_name: null,
		user_image: null,
		status: 'ready',
		linkable_payments: [],
	}

const pending = computed<boolean>(
	() =>
		paid.value &&
		members.value.some((member) => !rowByMember.value.has(keyOf(member)))
)

const visibleMembers = computed<string[]>(() => {
	if (!paid.value) return members.value
	return members.value.filter((member) => isEnrollable(rowOf(member).status))
})

const submitMembers = computed<string[]>(() =>
	paid.value
		? visibleMembers.value.filter((member) =>
				rowByMember.value.has(keyOf(member))
		  )
		: members.value
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

const busy = computed<boolean>(
	() => checking.value || previewLoading.value || pending.value
)

const paymentFor = (member: string): PaymentDefaults =>
	effectivePayment(defaults.value, overrides.value[member] ?? null)

const isIncomplete = (member: string): boolean => {
	const choice = choices.value[member]
	if (choice?.mode === 'link') return !choice.payment
	return (
		missingPaymentDetails(defaults.value, overrides.value[member] ?? null)
			.length > 0
	)
}

const paymentsReady = computed<boolean>(() =>
	canSubmitPayments(
		defaults.value,
		visibleMembers.value,
		choices.value,
		overrides.value
	)
)

const seatsExceeded = computed<boolean>(() =>
	exceedsSeats(rows.value, seatsLeft.value)
)

const seatsMessage = computed<string>(() => {
	if (!paid.value || seatsLeft.value === null || !seatsExceeded.value) return ''
	const ready = rows.value.filter((row) => row.status === 'ready').length
	return __('{0} seats left, {1} selected', [
		Math.max(seatsLeft.value, 0),
		ready,
	])
})

const canEnroll = computed<boolean>(() => {
	if (checking.value) return false
	if (!paid.value) return members.value.length > 0
	return (
		!busy.value &&
		submitMembers.value.length > 0 &&
		!seatsExceeded.value &&
		paymentsReady.value
	)
})

const studentName = (member: string): string =>
	rowOf(member).full_name || member

const kindBadge = (member: string): string | null => {
	if (!paid.value || props.target?.paidKind !== 'certificate') return null
	return rowOf(member).status === 'upgrade' ? __('Upgrade') : __('New')
}

const tableRows = (students: StudentOption[]): StudentRow[] => {
	const shown = new Set(visibleMembers.value.map(keyOf))
	return students
		.filter((student) => shown.has(keyOf(student.value)))
		.map((student) => {
			const member = student.value
			const row = rowByMember.value.get(keyOf(member))
			const choice = choices.value[member]
			const payment = paymentFor(member)
			const linking = choice?.mode === 'link'
			return {
				member,
				name: row?.full_name || student.label,
				image: row?.user_image ?? student.image,
				payment: listPaymentLabel(choice, payment) || NONE,
				billing: linking ? NONE : addressSummary(payment.address) || NONE,
				needsAddress: !linking && !hasAddress(payment.address),
				incomplete: isIncomplete(member),
				badge: kindBadge(member),
			}
		})
}

const linkedAmount = (member: string, payment: string | null) => {
	const linked = rowOf(member).linkable_payments.find(
		(item) => item.name === payment
	)
	return linked
		? { amount: linked.amount, currency: linked.currency }
		: { amount: null, currency: null }
}

const total = computed<string>(() =>
	paymentTotal(
		visibleMembers.value.map((member) => {
			const choice = choices.value[member]
			return choice?.mode === 'link'
				? linkedAmount(member, choice.payment)
				: paymentFor(member)
		})
	)
)

const panelShown = computed<boolean>(() => paid.value && panelOpen.value)

/** The only student stands for everyone, so the panel always names them. */
const panelRows = computed<EnrollPreviewRow[]>(() => {
	if (ticked.value.length) return ticked.value.map(rowOf)
	return visibleMembers.value.length === 1
		? [rowOf(visibleMembers.value[0])]
		: []
})

/**
 * Whether the panel edits the details for all: nothing ticked, or everyone
 * ticked with no details of their own. Decided when the ticked students change,
 * never while typing, so a field emptied for a group does not flip the panel.
 */
const editsCommon = ref<boolean>(true)
const panelKey = ref<number>(0)

const decidePanel = () => {
	const all = visibleMembers.value
	editsCommon.value =
		!ticked.value.length ||
		(ticked.value.length === all.length &&
			!ticked.value.some((member) => hasOwnDetails(overrides.value[member])))
}

watch(() => [...ticked.value, '|', ...visibleMembers.value].join(), decidePanel)

const commonAddressUsed = computed<boolean>(() =>
	visibleMembers.value.some(
		(member) =>
			choices.value[member]?.mode !== 'link' &&
			!overrides.value[member]?.address
	)
)

const statusText = computed<string>(() => {
	const count = visibleMembers.value.length
	if (!paid.value) return studentCountLabel(count)
	return [studentCountLabel(count), total.value].filter(Boolean).join(' · ')
})

/** The students still missing details, unless that is all of them. */
const incompleteMembers = computed<string[]>(() => {
	if (!paid.value) return []
	const incomplete = visibleMembers.value.filter(isIncomplete)
	return incomplete.length < visibleMembers.value.length ? incomplete : []
})

const commonIncomplete = computed<boolean>(
	() =>
		visibleMembers.value.some(
			(member) => choices.value[member]?.mode !== 'link'
		) && missingPaymentKeys(defaults.value, null, false).length > 0
)

/** Who Enter details opens the panel for; none means the details for all. */
const detailsMembers = computed<string[]>(() => {
	if (commonIncomplete.value) return []
	return incompleteMembers.value.length ? incompleteMembers.value : ticked.value
})

const detailsLabel = computed<string>(() => {
	if (!paid.value || panelOpen.value || busy.value) return ''
	if (!visibleMembers.value.length) return ''
	const named = detailsMembers.value.length
		? detailsMembers.value
		: visibleMembers.value.length === 1
		? visibleMembers.value
		: []
	if (named.length === 1) {
		return __('Enter details for {0}', [studentName(named[0])])
	}
	if (named.length > 1) {
		return __('Enter details for {0} students', [named.length])
	}
	return __('Enter details for all')
})

const needsAddress = computed<boolean>(
	() =>
		paid.value &&
		visibleMembers.value.some(
			(member) =>
				choices.value[member]?.mode !== 'link' &&
				!hasAddress(paymentFor(member).address)
		)
)

/** Until every student has an address, the primary action opens the details. */
const detailsFirst = computed<boolean>(
	() => needsAddress.value && !!detailsLabel.value
)

const panelRef = ref<{ focusFirst: () => void } | null>(null)
const flagMissing = ref<boolean>(false)

watch(panelOpen, (open) => {
	if (!open) flagMissing.value = false
})

const openDetails = async () => {
	const named = detailsMembers.value
	ticked.value = named.length ? [...named] : [...visibleMembers.value]
	panelOpen.value = true
	flagMissing.value = true
	await nextTick()
	// The details for all, even when some students have their own.
	const forAll = visibleMembers.value.length > 1 || commonIncomplete.value
	if (!named.length && forAll) editsCommon.value = true
	await nextTick()
	panelRef.value?.focusFirst()
}

const listOf = (keys: MissingKey[]): string => {
	const labels = keys.map(missingKeyLabel)
	const last = labels.pop() ?? ''
	return labels.length ? __('{0} and {1}', [labels.join(', '), last]) : last
}

const whoOf = (pending: string[]): string =>
	pending.length === 1
		? studentName(pending[0])
		: __('{0} students', [pending.length])

const reasonId = useId()

const missingReason = (): string => {
	const unlinked = visibleMembers.value.filter((member) => {
		const choice = choices.value[member]
		return choice?.mode === 'link' && !choice.payment
	})
	if (unlinked.length) {
		return __('Choose a payment to link for {0}', [whoOf(unlinked)])
	}
	const common = missingPaymentKeys(defaults.value, null, false)
	if (common.length) {
		return __('Fill in {0} in the details for all', [listOf(common)])
	}
	return pendingReason()
}

const pendingReason = (): string => {
	const pending = visibleMembers.value
		.filter((member) => choices.value[member]?.mode !== 'link')
		.map((member) => ({
			member,
			keys: missingPaymentKeys(defaults.value, overrides.value[member] ?? null),
		}))
		.filter((item) => item.keys.length)
	if (!pending.length) return ''
	const keys = pending[0].keys
	const who = whoOf(pending.map((item) => item.member))
	if (pending.some((item) => item.keys.join() !== keys.join())) {
		return __('Fill in the missing details for {0}', [who])
	}
	if (keys.length === 1 && keys[0] === 'address') {
		return __('Add a billing address for {0}', [who])
	}
	return __('Fill in {0} for {1}', [listOf(keys), who])
}

/** Why Enroll is disabled, shown on hover and focus and read with the button. */
const disabledReason = computed<string>(() => {
	if (detailsFirst.value || submitting.value || canEnroll.value) return ''
	if (checking.value || busy.value) return __('Checking the selected students')
	if (!submitMembers.value.length) return __('Add students to enroll')
	if (seatsExceeded.value) return seatsMessage.value
	return missingReason()
})

const closePanel = () => {
	panelOpen.value = false
	ticked.value = []
}

const onClose = () => {
	if (isMobile.value && panelShown.value) {
		closePanel()
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

let previewId = 0

const loadPreview = async () => {
	const target = props.target
	if (!target || !paid.value || !members.value.length) return
	const id = ++previewId
	previewLoading.value = true
	await submitResource(
		preview,
		{
			doctype: target.doctype,
			docname: target.name,
			members: JSON.stringify(members.value),
			purchased_certificate: target.paidKind === 'certificate',
		},
		{
			onSuccess(data) {
				if (id !== previewId || !data) return
				rows.value = data.rows
				seatsLeft.value = data.seats_left
				seedPayments(data)
			},
			onError(err: FrappeResourceError) {
				if (id !== previewId) return
				toast.error(resourceErrorMessage(err, __('Could not load students')))
			},
		}
	)
	if (id === previewId) previewLoading.value = false
}

const without = <T>(record: Record<string, T>, kept: Set<string>) =>
	Object.fromEntries(
		Object.entries(record).filter(([member]) => kept.has(keyOf(member)))
	)

watch(members, (next) => {
	previewId++
	previewLoading.value = false
	const kept = new Set(next.map(keyOf))
	ticked.value = ticked.value.filter((member) => kept.has(keyOf(member)))
	rows.value = rows.value.filter((row) => kept.has(keyOf(row.member)))
	choices.value = without(choices.value, kept)
	overrides.value = without(overrides.value, kept)
	if (!next.length) panelOpen.value = false
	if (pending.value) loadPreview()
})

watch(paid, (on) => {
	previewId++
	previewLoading.value = false
	rows.value = []
	ticked.value = []
	panelOpen.value = false
	if (on) loadPreview()
})

/** Also starts the panel over, so nothing typed before the reset lingers. */
const resetDetails = (members: string[]) => {
	const next = resetPaymentDetails(members, choices.value, overrides.value)
	choices.value = next.choices
	overrides.value = next.overrides
	decidePanel()
	panelKey.value++
}

const afterEnroll = (data: RawResult) => {
	const result = normalizeResult(data)
	emit('enrolled', result)
	const outcome = enrollOutcome(result)
	toast[outcome.type](outcome.message, {
		description: outcome.description || undefined,
	})
	const failed = new Set(result.errors.map((item) => keyOf(item.member)))
	if (!failed.size) {
		emit('close')
		return
	}
	members.value = members.value.filter((member) => failed.has(keyOf(member)))
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
			onSuccess: afterEnroll,
			onError(err: FrappeResourceError) {
				toast.error(resourceErrorMessage(err, __('Could not enroll students')))
			},
		}
	)
}
</script>
