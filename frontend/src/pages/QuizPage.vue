<template>
	<PageHeader v-if="!fromLesson" :breadcrumbs="breadcrumbs" />
	<div
		class="md:w-7/12 md:mx-auto mx-4 py-6"
		:class="{ 'pt-4 md:w-full': fromLesson }"
	>
		<Quiz :quizName="quizID" />
	</div>
</template>
<script setup>
import Quiz from '@/components/Quiz.vue'
import { createResource, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '../stores/session'

const { brand } = sessionStore()
const user = inject('$user')
const router = useRouter()
const fromLesson = ref(false)

onMounted(() => {
	if (!user.data) {
		router.push({ name: 'Courses' })
	}

	if (new URLSearchParams(window.location.search).get('fromLesson')) {
		fromLesson.value = true
	}
})

const props = defineProps({
	quizID: {
		type: String,
		required: true,
	},
})

const title = createResource({
	url: 'frappe.client.get_value',
	params: {
		doctype: 'LMS Quiz',
		fieldname: 'title',
		filters: {
			name: props.quizID,
		},
	},
	auto: true,
})

const quizTitle = computed(() => title.data?.title || __('Quiz'))

const breadcrumbs = computed(() => {
	// A learner arrives from a shared link. The authoring trail would lead to pages
	// they cannot open, and "Test Quiz" names the author's view, not theirs.
	if (user.data?.is_student) return [{ label: quizTitle.value }]
	return [
		{
			label: __('Quizzes'),
			route: { name: 'Quizzes' },
		},
		{
			label: quizTitle.value,
			route: { name: 'QuizForm', params: { quizID: props.quizID } },
		},
		{ label: __('Test Quiz') },
	]
})

usePageMeta(() => {
	return {
		title: quizTitle.value,
		icon: brand.favicon,
	}
})
</script>
