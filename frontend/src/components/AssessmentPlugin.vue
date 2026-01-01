<template>
	<Dialog
		v-model="show"
		:options="{
			title:
				type == 'quiz'
					? __('Add a quiz to your lesson')
					: __('Add an assignment to your lesson'),
			size: 'xl',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick: () => {
						addAssessment()
					},
				},
			],
		}"
	>
		<template #body-content>
			<div class="">
				<div>
					<Link
						v-if="type == 'quiz'"
						v-model="quiz"
						doctype="LMS Quiz"
						:label="__('Select a quiz')"
						placeholder=" "
						:onCreate="(value, close) => redirectToForm()"
					/>
					<div v-else class="space-y-4">
						<Link
							v-if="filterAssignmentsByCourse"
							v-model="assignment"
							doctype="LMS Assignment"
							:filters="{
								course: route.params.courseName,
							}"
							placeholder=" "
							:label="__('Select an Assignment')"
							:onCreate="(value, close) => redirectToForm()"
						/>
						<Link
							v-else
							v-model="assignment"
							doctype="LMS Assignment"
							placeholder=" "
							:label="__('Select an Assignment')"
							:onCreate="(value, close) => redirectToForm()"
						/>
						<FormControl
							type="checkbox"
							:label="__('Filter assignments by course')"
							v-model="filterAssignmentsByCourse"
						/>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl } from 'frappe-ui'
import { nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Link } from 'frappe-ui/frappe'

const show = ref(false)
const quiz = ref(null)
const assignment = ref(null)
const filterAssignmentsByCourse = ref(false)
const route = useRoute()

const props = defineProps({
	type: {
		type: String,
		required: true,
	},
	onAddition: {
		type: Function,
		required: true,
	},
})

onMounted(async () => {
	await nextTick()
	show.value = true
})

const addAssessment = () => {
	props.onAddition(props.type == 'quiz' ? quiz.value : assignment.value)
	show.value = false
}

const redirectToForm = () => {
	if (props.type == 'quiz') window.open('/lms/quizzes?new=true', '_blank')
	else window.open('/lms/assignments?new=true', '_blank')
}
</script>
