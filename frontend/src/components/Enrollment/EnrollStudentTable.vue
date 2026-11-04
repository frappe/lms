<template>
	<div ref="root" class="relative -mx-3 flex min-h-0 flex-1 flex-col">
		<div
			data-testid="student-table"
			class="min-h-0 flex-1 overflow-y-auto"
			:class="ticked.length ? 'pb-20' : ''"
		>
			<List
				v-model:selection="ticked"
				:columns="tracks"
				selectable
				class="enroll-student-list list-row-px-3"
				:aria-label="__('Selected students')"
			>
				<ListHeader class="sticky top-0 z-10 bg-surface-elevation-1">
					<ListHeaderCell data-testid="student-header">
						{{ __('Student') }}
					</ListHeaderCell>
					<ListHeaderCell v-if="!paid">{{ __('Email') }}</ListHeaderCell>
					<template v-else-if="!compact">
						<ListHeaderCell>{{ __('Payment') }}</ListHeaderCell>
						<ListHeaderCell>{{ __('Billing') }}</ListHeaderCell>
					</template>
					<ListHeaderCell v-else>
						<span class="sr-only">{{ __('Status') }}</span>
					</ListHeaderCell>
				</ListHeader>
				<div role="rowgroup">
					<ListRows :items="rows" rowKey="member" v-slot="{ item: row, value }">
						<ListRow
							:value="value"
							data-testid="student-row"
							:data-member="row.member"
							class="h-12"
						>
							<ListCell class="gap-2">
								<Avatar
									size="md"
									:image="row.image ?? undefined"
									:label="row.name"
									class="shrink-0"
								/>
								<div class="flex min-w-0 flex-col">
									<div class="flex min-w-0 items-center gap-2">
										<span
											data-testid="student-name"
											class="truncate text-base text-ink-gray-8"
										>
											{{ row.name }}
										</span>
										<Badge
											v-if="row.badge"
											variant="outline"
											theme="gray"
											:label="row.badge"
										/>
									</div>
									<span
										v-if="paid"
										data-testid="student-sub"
										class="truncate text-sm text-ink-gray-6"
									>
										{{ compact ? row.payment : row.member }}
									</span>
								</div>
							</ListCell>
							<ListCell v-if="!paid" class="text-base text-ink-gray-6">
								<span class="truncate">{{ row.member }}</span>
							</ListCell>
							<template v-else-if="!compact">
								<ListCell data-col="payment" class="text-base text-ink-gray-7">
									<span class="truncate">{{ row.payment }}</span>
								</ListCell>
								<ListCell data-col="billing" class="text-base text-ink-gray-7">
									<Badge
										v-if="row.needsAddress"
										data-testid="requires-address-badge"
										variant="outline"
										theme="gray"
										:label="__('Requires address')"
									/>
									<span v-else class="truncate">{{ row.billing }}</span>
								</ListCell>
							</template>
							<ListCell v-else data-col="status">
								<Badge
									v-if="row.incomplete"
									data-testid="incomplete-badge"
									variant="outline"
									theme="red"
									:label="__('Incomplete')"
								/>
							</ListCell>
						</ListRow>
					</ListRows>
				</div>
			</List>
		</div>
		<EnrollSelectionBanner
			:count="ticked.length"
			:total="rows.length"
			:paid="paid"
			@remove="emit('remove', [...ticked])"
			@reset="emit('reset', [...ticked])"
			@selectAll="ticked = rows.map((row) => row.member)"
			@clear="clearSelection"
		/>
	</div>
</template>
<script setup lang="ts">
import { Avatar, Badge } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { computed, nextTick, ref } from 'vue'
import EnrollSelectionBanner from '@/components/Enrollment/EnrollSelectionBanner.vue'
import type { StudentRow } from '@/types'

const props = defineProps<{
	rows: StudentRow[]
	paid: boolean
	compact: boolean
}>()

const emit = defineEmits<{
	remove: [members: string[]]
	reset: [members: string[]]
}>()

const ticked = defineModel<string[]>('ticked', { default: () => [] })

const tracks = computed<string[]>(() => {
	if (!props.paid) return ['minmax(0,1fr)', 'minmax(0,1fr)']
	if (props.compact) return ['minmax(0,1fr)', '6rem']
	return ['minmax(0,3fr)', 'minmax(0,2fr)', 'minmax(0,2fr)']
})

const root = ref<HTMLElement | null>(null)

const clearSelection = async () => {
	ticked.value = []
	await nextTick()
	root.value
		?.querySelector<HTMLElement>('[data-slot="list-header-checkbox"]')
		?.focus()
}
</script>
<style scoped>
/* The checkbox column is row padding, outside the grid area these borders span. */
.enroll-student-list :deep([data-slot='list-divider']),
.enroll-student-list :deep([data-slot='list-header-border']) {
	inset-inline-start: calc(-1 * var(--_list-checkbox-width, 0px));
}
</style>
