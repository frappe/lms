<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div
		v-if="submissions.loading || submissions.data?.length"
		class="md:w-3/4 md:mx-auto py-5 mx-5"
	>
		<div class="grid grid-cols-4 gap-5 mb-5">
			<Link
				doctype="LMS Assignment"
				v-model="assignmentID"
				:placeholder="__('Assignment')"
			/>
			<Link doctype="User" v-model="member" :placeholder="__('Member')" />
		</div>
		<ListView
			:columns="submissionColumns"
			:rows="submissions.data"
			rowKey="name"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
			>
				<ListHeaderItem :item="item" v-for="item in submissionColumns" />
			</ListHeader>
			<ListRows>
				<router-link
					v-for="row in submissions.data"
					:to="{
						name: 'AssignmentSubmission',
						params: {
							assignmentID: row.assignment,
							submissionName: row.name,
						},
					}"
				>
					<ListRow :row="row">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'status'">
									<Badge :theme="getStatusTheme(row[column.key])">
										{{ row[column.key] }}
									</Badge>
								</div>
								<div v-else>
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</router-link>
			</ListRows>
		</ListView>
	</div>
	<div
		v-else
		class="text-center p-5 text-gray-600 mt-52 w-3/4 md:w-1/2 mx-auto space-y-2"
	>
		<Pencil class="size-8 mx-auto stroke-1 text-gray-500" />
		<div class="text-xl font-medium">
			{{ __('No submissions') }}
		</div>
		<!-- <div class="leading-5">
			{{
				__(
					'There are no submissions for the assignment {0}.',
				).format(assignmentTitle.data?.title)
			}}
		</div> -->
	</div>
</template>
<script setup>
import {
	Badge,
	Breadcrumbs,
	createListResource,
	createResource,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil } from 'lucide-vue-next'
import Link from '@/components/Controls/Link.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const router = useRouter()
const assignmentID = ref('')
const member = ref('')

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator) {
		router.push({ name: 'Courses' })
	}

	assignmentID.value = router.currentRoute.value.params.assignmentID
	submissions.reload()
})

const getAssignmentFilters = () => {
	let filters = {}
	if (assignmentID.value) {
		console.log(assignmentID.value)
		filters.assignment = assignmentID.value
	}
	if (member.value) {
		console.log(member.value)
		filters.member = member.value
	}
	console.log(filters)
	return filters
}

const submissions = createListResource({
	doctype: 'LMS Assignment Submission',
	filters: getAssignmentFilters(),
	fields: [
		'name',
		'assignment',
		'assignment_title',
		'member_name',
		'creation',
		'status',
	],
	orderBy: 'creation desc',
	transform(data) {
		return data.map((row) => {
			return {
				...row,
				creation: dayjs(row.creation).fromNow(),
			}
		})
	},
})

watch([assignmentID, member], () => {
	console.log('watch called')
	submissions.reload()
})

/* const assignmentTitle = createResource({
    url: "frappe.client.get_value",
    params: {
        doctype: "LMS Assignment",
        fieldname: "title",
        filters: { name: props.assignmentID },
    },
}) */

const submissionColumns = computed(() => {
	return [
		{
			label: 'Member',
			key: 'member_name',
			width: 2,
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
			align: 'center',
		},
	]
})

const getStatusTheme = (status) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status === 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}

const breadcrumbs = computed(() => {
	return [
		{
			label: 'Assignment Submissions',
		},
	]
})
</script>
