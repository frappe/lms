<template>
	<Quiz v-if="user.data" :quizName="quiz"></Quiz>
	<div v-else class="border rounded-5 text-center py-20">
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
<script setup lang="ts">
import { inject } from 'vue'
import { Button } from 'frappe-ui'
import Quiz from '@/components/Quiz.vue'
import type { SessionUser } from '@/types'

const user = inject<SessionUser>('$user')!

defineProps<{
	quiz: string
}>()

const redirectToLogin = (): void => {
	window.location.href = `/login`
}
</script>
