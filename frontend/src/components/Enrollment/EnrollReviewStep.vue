<template>
	<div class="space-y-3">
		<ErrorMessage v-if="seatsMessage" :message="seatsMessage" />
		<LoadingText v-if="loading" />
		<ul v-else class="flex flex-col gap-1.5">
			<li
				v-for="row in rows"
				:key="row.member"
				class="flex items-center justify-between gap-2 rounded-6 bg-surface-gray-2 px-3 py-1.5"
			>
				<div class="flex min-w-0 items-center gap-2">
					<Avatar
						size="md"
						:image="row.user_image ?? undefined"
						:label="row.full_name || row.member"
					/>
					<div class="min-w-0">
						<div class="truncate text-base-medium text-ink-gray-8">
							{{ row.full_name || row.member }}
						</div>
						<div class="truncate text-sm text-ink-gray-6">
							{{ row.member }}
						</div>
					</div>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<Badge
						:theme="badgeTheme(row.status)"
						variant="subtle"
						:label="statusLabel(row.status)"
					/>
					<Button
						variant="ghost"
						icon="lucide-trash-2"
						:aria-label="__('Remove {0}', [row.full_name || row.member])"
						@click="emit('remove', row.member)"
					/>
				</div>
			</li>
		</ul>
	</div>
</template>
<script setup lang="ts">
import { Avatar, Badge, Button, ErrorMessage, LoadingText } from 'frappe-ui'
import { computed } from 'vue'
import { exceedsSeats, statusLabel } from '@/components/Enrollment/enrollment'
import type { EnrollPreviewRow, EnrollStatus } from '@/types'

const props = defineProps<{
	rows: EnrollPreviewRow[]
	seatsLeft: number | null
	loading: boolean
}>()

const emit = defineEmits<{
	remove: [member: string]
}>()

const badgeTheme = (status: EnrollStatus): 'green' | 'gray' =>
	status === 'ready' || status === 'upgrade' ? 'green' : 'gray'

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
