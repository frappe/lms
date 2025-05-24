<template>
	<Dialog
		v-model="show"
		:options="{
			size: 'lg',
		}"
	>
		<template #body>
			<div class="p-5 text-base max-h-[75vh] overflow-y-auto">
				<div class="text-lg text-ink-gray-9 font-semibold mb-5">
					{{
						assignmentID === 'new'
							? __('Create an Assignment')
							: __('Edit Assignment')
					}}
				</div>
				<div class="space-y-4">
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
							editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[18rem] overflow-y-auto"
						/>
					</div>
				</div>

				<div class="flex justify-end space-x-2 mt-5">
					<router-link
						:to="{
							name: 'AssignmentSubmissionList',
							query: {
								assignmentID: assignmentID,
							},
						}"
					>
						<Button v-if="assignmentID !== 'new'" variant="subtle">
							{{ __('Check Submissions') }}
						</Button>
					</router-link>
					<Button variant="solid" @click="saveAssignment">
						{{ __('Save') }}
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, Dialog, FormControl, TextEditor, toast } from 'frappe-ui'
import { computed, reactive, watch } from 'vue'

const show = defineModel()
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

const saveAssignment = () => {
	if (props.assignmentID == 'new') {
		assignments.value.insert.submit(
			{
				...assignment,
			},
			{
				onSuccess() {
					show.value = false
					toast.success(__('Assignment created successfully'))
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
					show.value = false
					toast.success(__('Assignment updated successfully'))
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
