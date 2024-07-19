<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div v-if="quizDetails" class="w-3/4 mx-auto py-5">
		<FormControl v-model="quiz.title" :label="__('Title')" />
		<FormControl v-model="quiz.total_marks" :label="__('Total Marks')" />
		<FormControl
			v-model="quiz.passing_percentage"
			:label="__('Passing Percentage')"
		/>
		<FormControl v-model="quiz.max_attempts" :label="__('Maximun Attempts')" />
		<FormControl
			v-model="quiz.limit_questions_to"
			:label="__('Limit Questions To')"
		/>
	</div>
</template>
<script setup>
import { Breadcrumbs, createDocumentResource, FormControl } from 'frappe-ui'
import { computed, reactive } from 'vue'

const props = defineProps({
	quizId: {
		type: String,
		required: true,
	},
})

const quiz = reactive({
	title: '',
	total_marks: '',
	passing_percentage: '',
	max_attempts: 0,
	limit_questions_to: 0,
	show_answers: true,
	show_submission_history: false,
	shuffle_questions: false,
	questions: [],
})

const quizDetails = createDocumentResource({
	doctype: 'LMS Quiz',
	name: props.quiz,
	auto: true,
	cache: ['quiz', props.quiz],
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('Quizzes'),
			route: {
				name: 'Quizzes',
			},
		},
	]
	return crumbs
})
</script>
