<template>
	<div class="text-base">
		<div class="flex items-center justify-between space-x-2 mb-5">
			<div class="flex items-center space-x-2">
				<ChevronLeft
					class="size-5 stroke-1.5 text-ink-gray-5 cursor-pointer"
					@click="
						() => {
							show = false
						}
					"
				/>
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ props.badgeName }}
				</div>
			</div>
			<Button @click="openForm('new')">
				<template #prefix>
					<Plus class="size-4 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</div>
		<div v-if="assignments.data?.length">
			<ListView
				:rows="assignments.data"
				:columns="columns"
				rowKey="name"
				:options="{
                    showTooltip: false,
                    onRowClick: (row: BadgeAssignment) => {
						openForm(row.name)
					},
                }"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns">
						<template #prefix="{ item }">
							<FeatherIcon
								v-if="item.icon"
								:name="item.icon"
								class="h-4 w-4 stroke-1.5"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in assignments.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<template #prefix>
									<div v-if="column.key == 'member_name'">
										<Avatar
											class="flex items-center"
											:image="row['member_image']"
											:label="item"
											size="sm"
										/>
									</div>
								</template>
								<div class="leading-5 text-sm">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="deleteBadgeAssignment(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
		<div v-else class="flex flex-col items-center justify-center mt-44">
			<GraduationCap class="size-10 mx-auto stroke-1 text-ink-gray-5" />
			<div class="text-lg font-semibold text-ink-gray-7 mb-2.5">
				{{ __('No Assignments') }}
			</div>
			<div
				class="leading-5 text-base w-2/5 text-base text-center text-ink-gray-7"
			>
				{{ __('This badge has not been assigned to any students yet') }}
			</div>
		</div>
	</div>
	<BadgeAssignmentForm
		v-model="showForm"
		:badgeAssignmentID="currentAssignmentID"
		:badge="props.badgeName"
		v-model:badgeAssignments="assignments"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	createListResource,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	toast,
} from 'frappe-ui'
import { ChevronLeft, GraduationCap, Plus, Trash2 } from 'lucide-vue-next'
import { computed, inject, ref } from 'vue'
import type { BadgeAssignment } from '@/components/Settings/types'
import BadgeAssignmentForm from '@/components/Settings/BadgeAssignmentForm.vue'

const show = defineModel<boolean>()
const dayjs = inject('$dayjs') as any
const showForm = ref(false)
const currentAssignmentID = ref<string>('')

const props = defineProps<{
	badgeName: string | null
}>()

const assignments = createListResource({
	doctype: 'LMS Badge Assignment',
	fields: [
		'name',
		'member',
		'member_name',
		'member_username',
		'member_image',
		'issued_on',
		'badge',
	],
	filters: {
		badge: props.badgeName,
	},
	order_by: 'issued_on desc',
	transform(data: BadgeAssignment[]) {
		return data.map((item: BadgeAssignment) => {
			return {
				...item,
				issued_on: item.issued_on
					? dayjs(item.issued_on).format('DD MMM YYYY')
					: null,
			}
		})
	},
	auto: true,
})

const openForm = (assignmentID: string) => {
	currentAssignmentID.value = assignmentID
	showForm.value = true
}

const deleteBadgeAssignment = (
	selections: Set<string>,
	unselectAll: () => void
) => {
	Array.from(selections).forEach(async (assignment: string) => {
		await assignments.delete.submit(assignment)
	})
	unselectAll()
	toast.success(__('Badge assignments deleted successfully'))
}

const columns = computed(() => {
	return [
		{
			label: __('Member'),
			key: 'member_name',
			icon: 'user',
			width: '60%',
		},
		{
			label: __('Issued On'),
			key: 'issued_on',
			icon: 'calendar',
			align: 'center',
		},
	]
})
</script>
