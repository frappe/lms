<template>
	<Dialog
		v-model="show"
		:options="{
			title:
				assignmentID === 'new'
					? __('Create an Assignment')
					: __('Edit Assignment'),
			size: 'lg',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick: (close) => saveAssignment(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4 text-base max-h-[65vh] overflow-y-auto">
				<FormControl
					v-model="assignment.title"
					:label="__('Title')"
					:required="true"
				/>
				<FormControl
					v-model="assignment.type"
					type="select"
					:options="assignmentOptions"
					:label="__('Submission Type')"
					:required="true"
				/>
				<div>
					<div class="text-xs text-ink-gray-5 mb-2">
						{{ __('Question') }}
						<span class="text-ink-red-3">*</span>
					</div>
					<TextEditor
						:content="assignment.question"
						@change="(val) => (assignment.question = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog, FormControl, TextEditor } from 'frappe-ui'
import { computed, reactive, watch } from 'vue'
import { showToast } from '@/utils'

const show = defineModel('show')
const assignments = defineModel<Assignments>('assignments')

interface Assignment {
	title: string
	type: string
	question: string
}

interface Assignments {
	data: Assignment[]
	get: (params: { doctype: string; name: string }) => Promise<Assignment>
	insert: {
		submit: (params: Assignment, options: { onSuccess: () => void }) => void
	}
}

const assignment = reactive({
	title: '',
	type: '',
	question: '',
})

const props = defineProps({
	assignmentID: {
		type: String,
		default: 'new',
	},
})

watch(
	() => props.assignmentID,
	(val) => {
		if (val !== 'new') {
			assignments.value?.data.forEach((row) => {
				if (row.name === val) {
					assignment.title = row.title
					assignment.type = row.type
					assignment.question = row.question
				}
			})
		}
	},
	{ flush: 'post' }
)

const saveAssignment = (close) => {
	if (props.assignmentID == 'new') {
		assignments.value.insert.submit(
			{
				...assignment,
			},
			{
				onSuccess() {
					close()
					showToast(
						__('Success'),
						__('Assignment created successfully'),
						'check'
					)
				},
			}
		)
	} else {
		assignments.value.setValue.submit(
			{
				...assignment,
				name: props.assignmentID,
			},
			{
				onSuccess() {
					close()
					showToast(
						__('Success'),
						__('Assignment updated successfully'),
						'check'
					)
				},
			}
		)
	}
}

const assignmentOptions = computed(() => {
	return [
		{ label: 'PDF', value: 'PDF' },
		{ label: 'Image', value: 'Image' },
		{ label: 'Document', value: 'Document' },
		{ label: 'Text', value: 'Text' },
		{ label: 'URL', value: 'URL' },
	]
})
</script>
