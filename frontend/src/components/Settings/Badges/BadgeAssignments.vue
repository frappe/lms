<template>
	<SettingsLayout
		:title="props.badgeName || ''"
		:description="
			__('See who has earned this badge and award it to more learners.')
		"
		:show-back="true"
		@back="show = false"
	>
		<template #header-actions>
			<Button variant="solid" @click="openForm('new')">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('New') }}
			</Button>
		</template>
		<List
			v-if="assignments.data?.length"
			:columns="columns"
			class="list-row-px-3"
		>
			<ListHeader>
				<ListHeaderCell>{{ __('Member') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Issued On') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows :items="assignments.data" row-key="name" v-slot="{ item: row }">
				<ListRow class="py-2.5" @click="openForm(row.name)">
					<ListCell class="gap-2">
						<Avatar
							:image="row.member_image"
							:label="row.member_name"
							size="lg"
							class="shrink-0"
						/>
						<div class="flex min-w-0 flex-col">
							<span class="truncate text-p-base-medium text-ink-gray-8">
								{{ row.member_name }}
							</span>
							<span class="truncate text-p-sm text-ink-gray-5">
								{{ row.member }}
							</span>
						</div>
					</ListCell>
					<ListCell class="text-p-base text-ink-gray-6">
						<span class="truncate">
							{{ row.issued_on }}
						</span>
					</ListCell>
					<ListCell class="justify-end" @click.stop>
						<Dropdown
							:options="[
								{
									label: __('Delete'),
									icon: 'lucide-trash-2',
									onClick: () => deleteBadgeAssignment(row.name),
								},
							]"
							:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>
		<div v-else class="flex flex-col items-center justify-center mt-44">
			<span class="lucide-graduation-cap size-10 mx-auto text-ink-gray-5" />
			<div class="text-lg-semibold text-ink-gray-7 mb-2.5">
				{{ __('No Assignments') }}
			</div>
			<div
				class="leading-5 text-base w-2/5 text-base text-center text-ink-gray-7"
			>
				{{ __('This badge has not been assigned to any students yet') }}
			</div>
		</div>
		<BadgeAssignmentForm
			v-model="showForm"
			:badgeAssignmentID="currentAssignmentID"
			:badge="props.badgeName"
			v-model:badgeAssignments="assignments"
		/>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Avatar, Button, Dropdown, createListResource, toast } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { inject, ref } from 'vue'
import type { BadgeAssignment } from '@/components/Settings/types'
import BadgeAssignmentForm from '@/components/Settings/Badges/BadgeAssignmentForm.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

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

// Grid track sizes shared by the header and every row (--list-columns).
const columns = ['minmax(0, 1fr)', '8rem', '2.25rem']

const openForm = (assignmentID: string) => {
	currentAssignmentID.value = assignmentID
	showForm.value = true
}

const deleteBadgeAssignment = async (assignment: string) => {
	await assignments.delete.submit(assignment)
	toast.success(__('Badge assignment deleted successfully'))
}
</script>
