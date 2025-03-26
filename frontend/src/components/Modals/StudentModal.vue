<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add a Student'),
			size: 'sm',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => addStudent(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<Link
					doctype="User"
					v-model="student"
					:filters="{ ignore_user_type: 1 }"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, createResource } from 'frappe-ui'
import { ref } from 'vue'
import Link from '@/components/Controls/Link.vue'
import { showToast } from '@/utils'
import { useOnboarding } from 'frappe-ui/frappe'

const students = defineModel('reloadStudents')
const student = ref()
const { updateOnboardingStep } = useOnboarding('learning')
const show = defineModel()

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const studentResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Batch Enrollment',
				batch: props.batch,
				member: student.value,
			},
		}
	},
})

const addStudent = (close) => {
	studentResource.submit(
		{},
		{
			onSuccess() {
				students.value.reload()
				student.value = null
				updateOnboardingStep('add_batch_student')
				close()
			},
			onError(err) {
				showToast(__('Error'), __(err.messages?.[0] || err), 'x')
			},
		}
	)
}
</script>
