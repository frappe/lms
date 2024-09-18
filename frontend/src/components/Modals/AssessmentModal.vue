<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add an assessment'),
			size: 'sm',
			actions: [
				{
					label: __('Submit'),
					variant: 'solid',
					onClick: (close) => addAssessment(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4">
				<FormControl
					type="select"
					:options="assessmentTypes"
					v-model="assessmentType"
					:label="__('Type')"
				/>
				<Link
					v-model="assessment"
					:doctype="assessmentType"
					:label="__('Assessment')"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl, createResource } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { computed, ref } from 'vue'
import { showToast } from '@/utils'

const show = defineModel()
const assessmentType = ref(null)
const assessment = ref(null)
const assessments = defineModel('assessments')

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const assessmentResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Assessment',
				parent: props.batch,
				parenttype: 'LMS Batch',
				parentfield: 'assessment',
				assessment_type: assessmentType.value,
				assessment_name: assessment.value,
			},
		}
	},
})

const addAssessment = (close) => {
	assessmentResource.submit(
		{},
		{
			onSuccess(data) {
				assessments.value.reload()
				showToast(__('Success'), __('Assessment added successfully'), 'check')
				close()
			},
		}
	)
}

const assessmentTypes = computed(() => {
	return [
		{ label: 'Quiz', value: 'LMS Quiz' },
		{ label: 'Assignment', value: 'LMS Assignment' },
	]
})
</script>
