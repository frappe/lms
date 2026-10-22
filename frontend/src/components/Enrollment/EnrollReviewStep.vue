<template>
	<div class="flex h-full min-h-0 flex-col gap-3">
		<ErrorMessage v-if="seatsMessage" :message="seatsMessage" />
		<LoadingText v-if="loading" />
		<ResponsiveListView
			v-else
			class="min-h-0 flex-1"
			:columns="columns"
			:rows="listRows"
			rowKey="name"
			:options="{ selectable: true, showTooltip: false }"
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
					<Badge
						v-if="row.kind"
						variant="outline"
						theme="gray"
						:label="row.kind as string"
					/>
				</div>
				<span v-else class="truncate">{{ row[column.key] }}</span>
			</template>
			<template #selection-actions="{ selections, unselectAll }">
				<Button
					variant="ghost"
					:label="__('Remove')"
					@click="removeSelected(selections, unselectAll)"
				>
					<template #icon>
						<span class="lucide-trash-2 size-4" aria-hidden="true" />
					</template>
				</Button>
			</template>
		</ResponsiveListView>
	</div>
</template>
<script setup lang="ts">
import { Avatar, Badge, Button, ErrorMessage, LoadingText } from 'frappe-ui'
import { computed } from 'vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import { exceedsSeats } from '@/components/Enrollment/enrollment'
import type { EnrollPreviewRow, ListColumn, ListRow } from '@/types'

const props = defineProps<{
	rows: EnrollPreviewRow[]
	seatsLeft: number | null
	loading: boolean
	paid: boolean
	certificate: boolean
	paymentLabels: Record<string, string>
}>()

const emit = defineEmits<{
	remove: [members: string[]]
}>()

const columns = computed<ListColumn[]>(() => {
	const items: ListColumn[] = [
		{ label: __('Student'), key: 'student', width: 3 },
		{ label: __('Email'), key: 'email', width: 3 },
	]
	if (props.paid) items.push({ label: __('Payment'), key: 'payment', width: 4 })
	return items
})

const listRows = computed<ListRow[]>(() =>
	props.rows.map((row) => ({
		name: row.member,
		student: row.full_name || row.member,
		image: row.user_image,
		email: row.member,
		kind: props.certificate
			? row.status === 'upgrade'
				? __('Upgrade')
				: __('New')
			: null,
		payment: props.paymentLabels[row.member] ?? '—',
	}))
)

const removeSelected = (
	selections: ReadonlySet<unknown>,
	unselectAll: () => void
) => {
	emit('remove', Array.from(selections, String))
	unselectAll()
}

const seatsMessage = computed<string>(() => {
	if (props.seatsLeft === null || !exceedsSeats(props.rows, props.seatsLeft))
		return ''
	const selected = props.rows.filter((row) => row.status === 'ready').length
	return __('{0} seats left, {1} selected', [
		Math.max(props.seatsLeft, 0),
		selected,
	])
})
</script>
