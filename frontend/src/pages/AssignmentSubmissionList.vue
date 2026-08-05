<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('Assignment Submissions')"
		layout="list"
		:columns="submissionColumns"
		:rows="submissions.data || []"
		:loading="submissions.loading"
		:has-next-page="submissions.hasNextPage"
		:list-options="{
			getRowRoute: (row) => ({
				name: 'AssignmentSubmission',
				params: {
					assignmentID: row.assignment,
					submissionName: row.name,
				},
			}),
		}"
		v-model:page-length="pageLength"
		empty-name="Assignment Submissions"
		empty-icon="lucide-pencil"
		@load-more="submissions.next()"
	>
		<template #filters>
			<Link
				doctype="LMS Assignment"
				v-model="assignmentID"
				:placeholder="__('Assignment')"
			/>
			<Link doctype="User" v-model="member" :placeholder="__('Member')" />
			<FormControl
				v-model="status"
				type="select"
				:options="statusOptions"
				:placeholder="__('Status')"
				:aria-label="__('Status')"
			/>
		</template>

		<template #cell="{ column, value }">
			<Badge v-if="column.key == 'status'" :theme="getStatusTheme(value)">
				{{ value }}
			</Badge>
			<div v-else>{{ value }}</div>
		</template>
	</ListPage>
</template>
<script setup>
import { Badge, createListResource, FormControl, usePageMeta } from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '../stores/session'
import Link from '@/components/Controls/Link.vue'
import ListPage from '@/components/Layouts/ListPage.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const router = useRouter()
const assignmentID = ref('')
const member = ref('')
const status = ref('')
const pageLength = ref(24)

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator) {
		router.push({ name: 'Courses' })
	}
	assignmentID.value = router.currentRoute.value.query.assignmentID
	member.value = router.currentRoute.value.query.member
	status.value = router.currentRoute.value.query.status
	reloadSubmissions()
})

const getAssignmentFilters = () => {
	let filters = {}
	if (assignmentID.value) {
		filters.assignment = assignmentID.value
	}
	if (member.value) {
		filters.member = member.value
	}
	if (status.value) {
		filters.status = status.value
	}
	return filters
}

const submissions = createListResource({
	doctype: 'LMS Assignment Submission',
	fields: [
		'name',
		'assignment',
		'assignment_title',
		'member_name',
		'creation',
		'status',
	],
	orderBy: 'creation desc',
	pageLength: 24,
	transform(data) {
		return data.map((row) => {
			return {
				...row,
				creation: dayjs(row.creation).fromNow(),
			}
		})
	},
})

watch(pageLength, (value) => {
	submissions.pageLength = value
	submissions.reload()
})

watch([assignmentID, member, status], () => {
	router.push({
		query: {
			assignmentID: assignmentID.value,
			member: member.value,
			status: status.value,
		},
	})
	reloadSubmissions()
})

const reloadSubmissions = () => {
	submissions.update({
		filters: getAssignmentFilters(),
	})
	submissions.reload()
}

const submissionColumns = computed(() => {
	return [
		{
			label: 'Member',
			key: 'member_name',
			width: 1,
		},
		{
			label: 'Assignment',
			key: 'assignment_title',
			width: 2,
		},
		{
			label: 'Submitted',
			key: 'creation',
			width: 1,
			align: 'left',
		},
		{
			label: 'Status',
			key: 'status',
			width: 1,
			align: 'left',
		},
	]
})

const statusOptions = computed(() => {
	return [
		{ label: '', value: '' },
		{ label: 'Pass', value: 'Pass' },
		{ label: 'Fail', value: 'Fail' },
		{ label: 'Not Graded', value: 'Not Graded' },
	]
})

const getStatusTheme = (status) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status === 'Not Graded') {
		return 'blue'
	} else {
		return 'red'
	}
}

// A parent crumb is what the phone header turns into a back link, so a
// single-crumb trail would leave this page with no way out but the tab bar.
const breadcrumbs = computed(() => {
	return [
		{ label: __('Assignments'), route: { name: 'Assignments' } },
		{ label: __('Submissions') },
	]
})

usePageMeta(() => {
	return {
		title: __('Assignment Submissions'),
		icon: brand.favicon,
	}
})
</script>
