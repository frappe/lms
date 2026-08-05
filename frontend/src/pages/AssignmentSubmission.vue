<template>
	<PageHeader v-if="!fromLesson" :breadcrumbs="breadcrumbs" />
	<div class="overflow-hidden h-[calc(100vh-3.2rem)]">
		<Assignment
			:assignmentID="assignmentID"
			:submissionName="submissionName"
			:showTitle="!fromLesson"
		/>
	</div>
</template>
<script setup>
import { createResource, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { computed, inject, onMounted, ref } from 'vue'
import { sessionStore } from '../stores/session'
import Assignment from '@/components/Assignment.vue'
import { provideStudentView } from '@/composables/useStudentView'

const user = inject('$user')
const fromLesson = ref(false)
const { brand } = sessionStore()

// Rendered in an iframe from the lesson preview, so provide/inject can't reach
// this app instance; Student View arrives as a query param instead. Without
// this the Grading panel shows up inside the preview and a moderator who
// submits the assignment there can grade themselves.
const studentView = ref(
	new URLSearchParams(window.location.search).get('studentView') === '1'
)
provideStudentView(user, () => studentView.value)

const props = defineProps({
	assignmentID: {
		type: String,
		required: true,
	},
	submissionName: {
		type: String,
		default: 'new',
	},
})

const title = createResource({
	url: 'frappe.client.get_value',
	params: {
		doctype: 'LMS Assignment',
		fieldname: 'title',
		filters: {
			name: props.assignmentID,
		},
	},
	auto: true,
})

onMounted(() => {
	if (!user.data) {
		window.location.href = '/login'
	}

	if (new URLSearchParams(window.location.search).get('fromLesson')) {
		fromLesson.value = true
	}
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('Submissions'),
			route: { name: 'AssignmentSubmissionList' },
		},
		{
			label: title.data?.title,
			route: {
				name: 'AssignmentSubmission',
				params: {
					assignmentID: props.assignmentID,
				},
			},
		},
	]
	return crumbs
})

usePageMeta(() => {
	return {
		title: title.data?.title,
		icon: brand.favicon,
	}
})
</script>
