<template>
	<SettingsList
		v-if="view === 'list'"
		:title="label"
		:description="__(description)"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search badges')"
		empty-name="Badges"
		empty-icon="lucide-award"
		@new="openForm('new')"
		@load-more="list.loadMore()"
		@row-click="(row) => openForm(row.name)"
	/>
	<BadgeForm
		v-else
		:badgeName="selectedBadge"
		v-model:badges="list.resource"
		@updateStep="(step) => (view = step)"
	/>
	<BadgeAssignments
		v-if="showAssignments"
		v-model="showAssignments"
		:badgeName="showAssignmentsFor"
	/>
</template>
<script setup lang="ts">
import { toast } from 'frappe-ui'
import { computed, ref } from 'vue'
import { cleanError } from '@/utils'
import BadgeForm from '@/components/Settings/Badges/BadgeForm.vue'
import BadgeAssignments from '@/components/Settings/Badges/BadgeAssignments.vue'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { Badge, SettingsListColumn } from '@/types'

const view = ref<'list' | 'form'>('list')
const selectedBadge = ref<string | null>(null)
const showAssignments = ref<boolean>(false)
const showAssignmentsFor = ref<string | null>(null)

defineProps<{
	label: string
	description: string
}>()

const list = useSettingsListResource<Badge>({
	doctype: 'LMS Badge',
	fields: [
		'name',
		'title',
		'enabled',
		'description',
		'image',
		'grant_only_once',
		'event',
		'reference_doctype',
		'condition',
		'user_field',
		'field_to_check',
	],
	searchFields: ['title', 'description'],
	orderBy: 'creation desc',
})

const doctypeLabel = computed(() => {
	return {
		'LMS Course': __('Course'),
		'LMS Batch': __('Batch'),
		'LMS Enrollment': __('Course Enrollment'),
		'LMS Batch Enrollment': __('Batch Enrollment'),
		'LMS Quiz Submission': __('Quiz Submission'),
		'LMS Assignment Submission': __('Assignment Submission'),
		'LMS Programming Exercise Submission': __(
			'Programming Exercise Submission'
		),
	}
})

const deleteBadge = (badgeName: string) => {
	list.remove(badgeName, {
		onSuccess: () => toast.success(__('Badge deleted successfully')),
		onError: (err) =>
			toast.error(cleanError(err.messages?.[0]) || __('Error deleting badge')),
	})
}

const getMoreOptions = (badgeName: string) => [
	{
		label: __('Assignments'),
		icon: 'lucide-download',
		onClick() {
			showAssignmentsFor.value = badgeName
			showAssignments.value = true
		},
	},
	{
		label: __('Delete'),
		icon: 'lucide-trash-2',
		onClick() {
			deleteBadge(badgeName)
		},
	},
]

const columns: SettingsListColumn[] = [
	{
		key: 'title',
		label: __('Badge'),
		type: 'text',
		width: 'minmax(0, 1.3fr)',
		value: (row) => row.title,
	},
	{
		key: 'reference_doctype',
		label: __('Awarded For'),
		type: 'text',
		value: (row) =>
			doctypeLabel.value[
				row.reference_doctype as keyof typeof doctypeLabel.value
			] || row.reference_doctype,
	},
	{
		key: 'grant',
		label: __('Grant'),
		type: 'text',
		width: '7rem',
		value: (row) => (row.grant_only_once ? __('Once') : __('Every time')),
	},
	{
		key: 'status',
		label: __('Status'),
		type: 'badge',
		width: '6.5rem',
		badges: (row) => [
			row.enabled
				? { label: __('Enabled'), theme: 'green' }
				: { label: __('Disabled'), theme: 'gray' },
		],
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.title),
		options: (row) => getMoreOptions(row.name),
	},
]

const openForm = (badgeName: string) => {
	selectedBadge.value = badgeName
	view.value = 'form'
}
</script>
