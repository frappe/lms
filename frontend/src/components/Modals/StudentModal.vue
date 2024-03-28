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

const students = defineModel('reloadStudents')
const student = ref()
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
				doctype: 'Batch Student',
				parent: props.batch,
				parenttype: 'LMS Batch',
				parentfield: 'students',
				student: student.value,
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
				close()
				student.value = null
			},
		}
	)
}
</script>
