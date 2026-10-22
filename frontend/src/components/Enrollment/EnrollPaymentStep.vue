<template>
	<div class="flex h-full min-h-0">
		<div
			v-if="!isMobile || !panelOpen"
			class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto"
			:class="isMobile ? '' : 'pe-4'"
		>
			<div v-if="isMobile">
				<Button
					data-testid="common-details-open"
					variant="outline"
					:label="__('Common details')"
					@click="openCommon"
				/>
			</div>
			<ResponsiveListView
				:key="listKey"
				class="min-h-0 flex-1"
				:columns="columns"
				:rows="listRows"
				rowKey="name"
				:options="listOptions"
			>
				<template #cell="{ column, row }">
					<div
						v-if="column.key === 'student'"
						class="flex min-w-0 items-center gap-2"
					>
						<Avatar
							size="sm"
							:image="(row.image as string | null) ?? undefined"
							:label="row.student as string"
						/>
						<span class="truncate">{{ row.student }}</span>
						<span v-if="row.active" class="sr-only">{{ __('Selected') }}</span>
						<span v-if="row.incomplete" data-testid="incomplete-badge">
							<Badge variant="outline" theme="red" :label="__('Incomplete')" />
						</span>
						<span v-else-if="row.custom" data-testid="custom-badge">
							<Badge variant="outline" theme="blue" :label="__('Custom')" />
						</span>
					</div>
					<span v-else class="truncate">{{ row[column.key] }}</span>
				</template>
			</ResponsiveListView>
		</div>
		<div class="sr-only" aria-live="polite" data-testid="panel-announcer">
			{{ panelTitle }}
		</div>
		<div
			v-if="!isMobile || panelOpen"
			data-testid="payment-panel"
			:class="isMobile ? 'w-full' : 'w-80 shrink-0 overflow-y-auto'"
		>
			<EnrollPaymentPanel
				v-model:defaults="defaults"
				v-model:choices="choices"
				v-model:overrides="overrides"
				:row="activeRow"
				:showBack="isMobile"
				@common="showCommon"
				@back="panelOpen = false"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Avatar, Badge, Button } from 'frappe-ui'
import { computed, ref } from 'vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import EnrollPaymentPanel from '@/components/Enrollment/EnrollPaymentPanel.vue'
import {
	addressSummary,
	effectivePayment,
	hasOverride,
	listPaymentLabel,
	missingPaymentDetails,
} from '@/components/Enrollment/enrollment'
import type {
	EnrollPreviewRow,
	ListColumn,
	ListRow,
	ListViewOptions,
	PaymentChoice,
	PaymentDefaults,
	PaymentOverride,
} from '@/types'
import { useScreenSize } from '@/utils/composables'

const props = defineProps<{
	rows: EnrollPreviewRow[]
}>()

const defaults = defineModel<PaymentDefaults>('defaults', { required: true })
const choices = defineModel<Record<string, PaymentChoice>>('choices', {
	default: () => ({}),
})
const overrides = defineModel<Record<string, PaymentOverride>>('overrides', {
	default: () => ({}),
})

const panelOpen = defineModel<boolean>('panelOpen', { default: false })

const { isMobile } = useScreenSize()
const activeMember = ref<string | null>(null)
const listKey = ref<number>(0)

const activeRow = computed<EnrollPreviewRow | null>(
	() => props.rows.find((row) => row.member === activeMember.value) ?? null
)

const panelTitle = computed<string>(() =>
	activeRow.value
		? activeRow.value.full_name || activeRow.value.member
		: __('Common details')
)

const columns: ListColumn[] = [
	{ label: __('Student'), key: 'student', width: 4 },
	{ label: __('Payment'), key: 'payment', width: 3 },
	{ label: __('Billing address'), key: 'address', width: 3 },
]

const NONE = '—'

const listRow = (row: EnrollPreviewRow): ListRow => {
	const choice = choices.value[row.member]
	const override = overrides.value[row.member] ?? null
	const payment = effectivePayment(defaults.value, override)
	const linking = choice?.mode === 'link'
	return {
		name: row.member,
		student: row.full_name || row.member,
		image: row.user_image,
		active: row.member === activeMember.value,
		custom: !linking && hasOverride(overrides.value[row.member]),
		incomplete: linking
			? !choice.payment
			: missingPaymentDetails(defaults.value, override).length > 0,
		payment: listPaymentLabel(choice, payment) || NONE,
		address: linking ? NONE : addressSummary(payment.address) || NONE,
	}
}

const listRows = computed<ListRow[]>(() => props.rows.map(listRow))

const onRowClick = (row: ListRow) => {
	const member = String(row.name)
	if (isMobile.value) {
		activeMember.value = member
		panelOpen.value = true
		return
	}
	activeMember.value = activeMember.value === member ? null : member
}

const listOptions: ListViewOptions = {
	selectable: false,
	showTooltip: false,
	enableActive: true,
	onRowClick,
}

const showCommon = () => {
	activeMember.value = null
	listKey.value++
}

const openCommon = () => {
	activeMember.value = null
	panelOpen.value = true
}
</script>
