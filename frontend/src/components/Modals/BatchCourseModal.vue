<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add a course'),
			size: 'sm',
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
			<Link doctype="LMS Course" v-model="course" />
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, createResource } from 'frappe-ui'
import { ref, defineModel } from 'vue'
import Link from '@/components/Controls/Link.vue'
import { showToast } from '@/utils'

const show = defineModel()
const course = ref(null)
const courses = defineModel('courses')

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const createBatchCourse = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Batch Course',
				parent: props.batch,
				parenttype: 'LMS Batch',
				parentfield: 'courses',
				course: course.value,
			},
		}
	},
})

const addCourse = (close) => {
	createBatchCourse.submit(
		{},
		{
			onSuccess() {
				courses.value.reload()
				close()
				course.value = null
			},
			onError(err) {
				showToast('Error', err.message[0] || err, 'x')
			},
		}
	)
}
</script>
