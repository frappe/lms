<template>
	<Quiz v-if="user.data" :quizName="quiz"></Quiz>
	<div v-else class="border rounded-md text-center py-20">
		<div>
			{{ __('Please login to access the quiz.') }}
		</div>
		<Button @click="redirectToLogin()" class="mt-2">
			<span>
				{{ __('Login') }}
			</span>
		</Button>
	</div>
</template>
<script setup>
import { inject } from 'vue'
import { Button } from 'frappe-ui'
import Quiz from '@/components/Quiz.vue'

const user = inject('$user')
const props = defineProps({
	quiz: {
		type: String,
		required: true,
	},
})

const redirectToLogin = () => {
	window.location.href = `/login`
}
</script>
