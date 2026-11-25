<template>
	<span v-if="columnKey === 'member_name'" class="flex items-center gap-2.5">
		<Avatar
			:image="student.member_image ?? undefined"
			:label="student.member_name"
			size="md"
		/>
		<span class="min-w-0 truncate text-sm text-ink-gray-8">
			{{ student.member_name }}
		</span>
	</span>
	<span
		v-else-if="columnKey === 'progress'"
		class="text-sm tabular-nums text-ink-gray-7"
	>
		{{ progressLabel }}
	</span>
	<span
		v-else-if="columnKey === 'payment_status'"
		class="flex items-center gap-1.5"
	>
		<Badge variant="outline" :theme="paymentTheme" :label="paymentLabel" />
		<span v-if="amountLabel" class="truncate text-xs text-ink-gray-6">
			{{ amountLabel }}
		</span>
	</span>
	<span v-else-if="columnKey === 'last_active'" class="text-sm text-ink-gray-6">
		{{ lastActiveLabel }}
	</span>
	<span v-else-if="columnKey === 'enrolled_on'" class="text-sm text-ink-gray-6">
		{{ enrolledLabel }}
	</span>
	<span
		v-else-if="columnKey === 'actions'"
		class="flex justify-end"
		@click.stop
	>
		<Dropdown :options="actions" align="end">
			<Button
				variant="ghost"
				icon="lucide-more-horizontal"
				:aria-label="actionsLabel"
			/>
		</Dropdown>
	</span>
</template>
<script setup lang="ts">
import { Avatar, Badge, Button, Dropdown } from 'frappe-ui'
import type { DropdownOption } from 'frappe-ui'
import { computed, inject } from 'vue'
import type dayjsType from 'dayjs'
import { timeAgo } from '@/utils/format'
import { PAYMENT_LABELS, PAYMENT_THEMES } from '@/utils/dashboard/filters'
import type { CourseStudentRow } from '@/types'

const props = defineProps<{
	columnKey: string
	student: CourseStudentRow
	actions: DropdownOption[]
	compact: boolean
}>()

const dayjs = inject<typeof dayjsType>('$dayjs')!

const formatAmount = (amount: number, currency: string | null): string =>
	currency
		? amount.toLocaleString(undefined, {
				style: 'currency',
				currency,
				maximumFractionDigits: 0,
		  })
		: amount.toLocaleString()

const progressLabel = computed<string>(() => {
	const percent = String(Math.round(props.student.progress))
	return props.compact ? __('{0}% done').format(percent) : `${percent}%`
})
const paymentLabel = computed<string>(() =>
	PAYMENT_LABELS[props.student.payment_status]()
)
const paymentTheme = computed(
	() => PAYMENT_THEMES[props.student.payment_status]
)
const amountLabel = computed<string>(() =>
	props.student.amount
		? formatAmount(props.student.amount, props.student.currency)
		: ''
)
const lastActiveLabel = computed<string>(() =>
	props.student.last_active ? timeAgo(props.student.last_active) : __('Never')
)
const enrolledLabel = computed<string>(() =>
	dayjs(props.student.enrolled_on).format('DD MMM YYYY')
)
const actionsLabel = computed<string>(() =>
	__('Actions for {0}').format(props.student.member_name)
)
</script>
