<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="quizTitle"
		layout="list"
		:columns="quizColumns"
		:rows="submissions.data || []"
		:loading="submissions.loading"
		:has-next-page="submissions.hasNextPage"
		:list-options="{
			showTooltip: false,
			selectable: false,
			getRowRoute: (row) => ({
				name: 'QuizSubmission',
				params: { submission: row.name },
			}),
		}"
		v-model:page-length="pageLength"
		empty-name="Quiz Submissions"
		empty-icon="lucide-file-check"
		@load-more="submissions.next()"
	/>
</template>
<script setup>
import { createListResource, usePageMeta } from 'frappe-ui'
import { computed, onMounted, inject, ref, watch } from 'vue'
import { sessionStore } from '../stores/session'
import { useRouter } from 'vue-router'
import ListPage from '@/components/Layouts/ListPage.vue'

const { brand } = sessionStore()
const router = useRouter()
const user = inject('$user')

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator)
		router.push({ name: 'Courses' })
})

const props = defineProps({
	quizID: {
		type: String,
		required: true,
	},
})

const submissions = createListResource({
	doctype: 'LMS Quiz Submission',
	filters: {
		quiz: props.quizID,
	},
	fields: ['name', 'member_name', 'score', 'percentage', 'quiz_title'],
	orderBy: 'creation desc',
	pageLength: 24,
	auto: true,
})

const pageLength = ref(24)

watch(pageLength, (value) => {
	submissions.pageLength = value
	submissions.reload()
})

const quizColumns = computed(() => {
	return [
		{
			label: __('Member'),
			key: 'member_name',
			width: 1,
		},
		{
			label: __('Score'),
			key: 'score',
			width: 1,
			align: 'left',
		},
		{
			label: __('Percentage'),
			key: 'percentage',
			width: 1,
			align: 'left',
		},
	]
})

const quizTitle = computed(() => submissions.data?.[0]?.quiz_title || '')

const breadcrumbs = computed(() => {
	const crumbs = [
		{
			label: __('Quizzes'),
			route: { name: 'Quizzes' },
		},
	]

	if (quizTitle.value) {
		crumbs.push({
			label: quizTitle.value,
			route: { name: 'QuizForm', params: { quizID: props.quizID } },
		})
	}

	crumbs.push({ label: __('Submissions') })
	return crumbs
})

usePageMeta(() => {
	return {
		title: __('Quiz Submissions'),
		icon: brand.favicon,
	}
})
</script>
