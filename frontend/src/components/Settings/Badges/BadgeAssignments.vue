<template>
	<SettingsList
		:title="props.badgeName || ''"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search members')"
		show-back
		empty-name="Assignments"
		empty-icon="lucide-graduation-cap"
		@back="show = false"
		@new="openForm('new')"
		@load-more="list.loadMore()"
		@row-click="(row) => openForm(row.name)"
	/>
	<BadgeAssignmentForm
		v-model="showForm"
		:badgeAssignmentID="currentAssignmentID"
		:badge="props.badgeName"
		v-model:badgeAssignments="list.resource"
	/>
</template>
<script setup lang="ts">
import { toast } from 'frappe-ui'
import { inject, ref } from 'vue'
import BadgeAssignmentForm from '@/components/Settings/Badges/BadgeAssignmentForm.vue'
import { cleanError } from '@/utils'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { BadgeAssignment, SettingsListColumn } from '@/types'

const show = defineModel<boolean>()
const dayjs = inject('$dayjs') as any
const showForm = ref(false)
const currentAssignmentID = ref<string>('')

const props = defineProps<{
	badgeName: string | null
}>()

const list = useSettingsListResource<BadgeAssignment>({
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
	searchFields: ['member_name', 'member'],
	filters: { badge: props.badgeName },
	orderBy: 'issued_on desc',
})

const deleteBadgeAssignment = (assignment: string) =>
	list.remove(assignment, {
		onSuccess: () => toast.success(__('Badge assignment deleted successfully')),
		onError: (err) => toast.error(cleanError(err.messages?.[0])),
	})

// issued_on stays the raw date on the row: formatting it in a `transform` put a
// display string back into a Date field on the next save.
const columns: SettingsListColumn[] = [
	{
		key: 'member',
		label: __('Member'),
		type: 'stacked',
		primary: (row) => row.member_name,
		secondary: (row) => row.member,
		avatar: (row) => ({ image: row.member_image, label: row.member_name }),
	},
	{
		key: 'issued_on',
		label: __('Issued On'),
		type: 'text',
		width: '8rem',
		value: (row) =>
			row.issued_on ? dayjs(row.issued_on).format('DD MMM YYYY') : '',
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.member_name),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => deleteBadgeAssignment(row.name),
			},
		],
	},
]

const openForm = (assignmentID: string) => {
	currentAssignmentID.value = assignmentID
	showForm.value = true
}
</script>
