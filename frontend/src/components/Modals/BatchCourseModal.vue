<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add a course to the batch'),
			size: 'lg',
			actions: [
				{
					label: __('Submit'),
					variant: 'solid',
					onClick: (close) => addCourse(close),
				},
			],
		}"
	>
		<template #body-content>
			<Link
				doctype="LMS Course"
				v-model="course"
				:label="__('Course')"
				:required="true"
				:filters="{ published: 1 }"
				:onCreate="
					(value, close) => {
						close()
						router.push({
							name: 'Courses',
							query: { newCourse: '1' },
						})
					}
				"
			/>
			<Link
				doctype="Course Evaluator"
				v-model="evaluator"
				:label="__('Evaluator')"
				:onCreate="(value, close) => openSettings('Evaluators', close)"
				class="mt-4"
			/>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, toast } from 'frappe-ui'
import { ref, inject } from 'vue'
import Link from '@/components/Controls/Link.vue'
import { useOnboarding } from 'frappe-ui/frappe'
import { openSettings } from '@/utils'
import { useRouter } from 'vue-router'

const show = defineModel()
const course = ref(null)
const evaluator = ref(null)
const user = inject('$user')
const courses = defineModel('courses')
const router = useRouter()
const { updateOnboardingStep } = useOnboarding('learning')

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const addCourse = (close) => {
	courses.value.insert.submit(
		{
			course: course.value,
			evaluator: evaluator.value,
			parent: props.batch,
			parenttype: 'LMS Batch',
			parentfield: 'courses',
		},
		{
			onSuccess() {
				if (user.data?.is_system_manager)
					updateOnboardingStep('add_batch_course')

				close()
				course.value = null
				evaluator.value = null
				toast.success(__('Course added to batch successfully'))
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
				console.log(err)
			},
		}
	)
}
</script>
