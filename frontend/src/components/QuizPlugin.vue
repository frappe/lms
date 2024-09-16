<template>
	<Dialog
		v-model="show"
		:options="{
			size: 'xl',
		}"
	>
		<template #body>
			<div class="p-5 space-y-4">
				<div class="text-lg font-semibold">
					{{ __('Add a quiz to your lesson') }}
				</div>
				<div>
					<Link
						v-model="quiz"
						doctype="LMS Quiz"
						:label="__('Select a quiz')"
						:onCreate="(value, close) => redirectToQuizForm()"
					/>
				</div>
				<div class="flex justify-end space-x-2">
					<Button variant="solid" @click="addQuiz()">
						{{ __('Save') }}
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Button } from 'frappe-ui'
import { onMounted, ref, nextTick } from 'vue'
import Link from '@/components/Controls/Link.vue'

const show = ref(false)
const quiz = ref(null)

const props = defineProps({
	onQuizAddition: {
		type: Function,
		required: true,
	},
})

onMounted(async () => {
	await nextTick()
	show.value = true
})

const addQuiz = () => {
	props.onQuizAddition(quiz.value)
	show.value = false
}

const redirectToQuizForm = () => {
	window.open('/lms/quizzes/new', '_blank')
}
</script>
