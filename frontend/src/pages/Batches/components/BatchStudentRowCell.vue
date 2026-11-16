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
		v-else-if="columnKey === 'attendance'"
		class="text-sm tabular-nums"
		:class="lowAttendance ? 'font-medium text-ink-red-7' : 'text-ink-gray-7'"
	>
		<span v-if="lowAttendance" class="sr-only"
			>{{ __('Low attendance') }}:</span
		>
		{{ attendanceLabel }}
	</span>
	<span v-else-if="columnKey === 'last_active'" class="text-sm text-ink-gray-6">
		{{ lastActiveLabel }}
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
import { Avatar, Button, Dropdown } from 'frappe-ui'
import type { DropdownOption } from 'frappe-ui'
import { computed } from 'vue'
import { isLowAttendance } from '@/utils/dashboard/batchStudent'
import { timeAgo } from '@/utils/format'
import type { BatchStudentRow } from '@/types'

const props = defineProps<{
	columnKey: string
	student: BatchStudentRow
	actions: DropdownOption[]
	compact: boolean
}>()

const progressLabel = computed<string>(() => {
	const percent = String(Math.round(props.student.progress))
	return props.compact ? __('{0}% done').format(percent) : `${percent}%`
})

const lowAttendance = computed<boolean>(() =>
	isLowAttendance(props.student.attended, props.student.held)
)

const attendanceLabel = computed<string>(() => {
	if (!props.student.held) return '—'
	const percent = String(
		Math.round((props.student.attended / props.student.held) * 100)
	)
	return props.compact ? __('{0}% attendance').format(percent) : `${percent}%`
})

const lastActiveLabel = computed<string>(() =>
	props.student.last_active ? timeAgo(props.student.last_active) : __('Never')
)

const actionsLabel = computed<string>(() =>
	__('Actions for {0}').format(props.student.member_name)
)
</script>
