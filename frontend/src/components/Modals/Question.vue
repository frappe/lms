<template>
	<Dialog v-model="show" :options="dialogOptions">
		<template #body-content>
			<div class="space-y-4">
				<div
					v-if="!editMode"
					class="flex items-center text-xs text-ink-gray-7 space-x-5"
				>
					<div class="flex items-center space-x-2">
						<input
							type="radio"
							id="existing"
							value="existing"
							v-model="questionType"
							class="w-3 h-3 cursor-pointer"
						/>
						<label for="existing" class="cursor-pointer">
							{{ __('Add an existing question') }}
						</label>
					</div>

					<div class="flex items-center space-x-2">
						<input
							type="radio"
							id="new"
							value="new"
							v-model="questionType"
							class="w-3 h-3 cursor-pointer"
						/>
						<label for="new" class="cursor-pointer">
							{{ __('Create a new question') }}
						</label>
					</div>
				</div>
				<div v-if="questionType == 'new' || editMode" class="space-y-2">
					<div>
						<label class="block text-xs text-ink-gray-5 mb-1">
							{{ __('Question') }}
						</label>
						<TextEditor
							:content="question.question"
							@change="(val) => (question.question = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
					<FormControl
						v-model="question.marks"
						:label="__('Marks')"
						type="number"
					/>
					<FormControl
						:label="__('Type')"
						v-model="question.type"
						type="select"
						:options="['Choices', 'User Input', 'Open Ended']"
						class="pb-2"
						:required="true"
					/>
					<div v-if="question.type == 'Choices'" class="divide-y border-t">
						<div v-for="n in 4" class="space-y-4 py-2">
							<FormControl
								:label="__('Option') + ' ' + n"
								v-model="question[`option_${n}`]"
								:required="n <= 2 ? true : false"
							/>
							<FormControl
								:label="__('Explanation')"
								v-model="question[`explanation_${n}`]"
							/>
							<FormControl
								:label="__('Correct Answer')"
								v-model="question[`is_correct_${n}`]"
								type="checkbox"
							/>
						</div>
					</div>
					<div
						v-else-if="question.type == 'User Input'"
						v-for="n in 4"
						class="space-y-2"
					>
						<FormControl
							:label="__('Possibility') + ' ' + n"
							v-model="question[`possibility_${n}`]"
							:required="n == 1 ? true : false"
						/>
					</div>
				</div>
				<div v-else-if="questionType == 'existing'" class="space-y-2">
					<Link
						v-model="existingQuestion.question"
						:label="__('Select a question')"
						doctype="LMS Question"
					/>
					<FormControl
						v-model="existingQuestion.marks"
						:label="__('Marks')"
						type="number"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl, TextEditor, createResource } from 'frappe-ui'
import { computed, watch, reactive, ref } from 'vue'
import Link from '@/components/Controls/Link.vue'
import { showToast } from '@/utils'
import { useOnboarding } from 'frappe-ui/frappe'

const show = defineModel()
const quiz = defineModel('quiz')
const questionType = ref(null)
const editMode = ref(false)
const { updateOnboardingStep } = useOnboarding('learning')

const existingQuestion = reactive({
	question: '',
	marks: 0,
})
const question = reactive({
	question: '',
	type: 'Choices',
	marks: 1,
})

const populateFields = () => {
	let fields = ['option', 'is_correct', 'explanation', 'possibility']
	let counter = 1
	fields.forEach((field) => {
		while (counter <= 4) {
			question[`${field}_${counter}`] = field === 'is_correct' ? false : null
			counter++
		}
	})
}

populateFields()

const props = defineProps({
	title: {
		type: String,
		default: __('Add a new question'),
	},
	questionDetail: {
		type: [Object, null],
		required: true,
	},
})

const questionData = createResource({
	url: 'frappe.client.get',
	makeParams() {
		return {
			doctype: 'LMS Question',
			name: props.questionDetail.question,
		}
	},
	auto: false,
	onSuccess(data) {
		let counter = 1
		editMode.value = true
		Object.keys(data).forEach((key) => {
			if (Object.hasOwn(question, key)) question[key] = data[key]
		})
		while (counter <= 4) {
			question[`is_correct_${counter}`] = data[`is_correct_${counter}`]
				? true
				: false
			counter++
		}
		question.marks = props.questionDetail.marks
	},
})

watch(show, () => {
	if (show.value) {
		editMode.value = false
		if (props.questionDetail.question) questionData.fetch()
		else {
			;(question.question = ''), (question.marks = 0)
			question.type = 'Choices'
			existingQuestion.question = ''
			existingQuestion.marks = 0
			questionType.value = null
			populateFields()
		}

		if (props.questionDetail.marks) question.marks = props.questionDetail.marks
	}
})

const questionRow = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Quiz Question',
				parent: quiz.value.data.name,
				parentfield: 'questions',
				parenttype: 'LMS Quiz',
				...values,
			},
		}
	},
})

const questionCreation = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Question',
				...question,
			},
		}
	},
})

const submitQuestion = (close) => {
	if (props.questionDetail?.question) updateQuestion(close)
	else addQuestion(close)
}

const addQuestion = (close) => {
	if (questionType.value == 'existing') {
		addQuestionRow(
			{
				question: existingQuestion.question,
				marks: existingQuestion.marks,
			},
			close
		)
	} else {
		questionCreation.submit(
			{},
			{
				onSuccess(data) {
					addQuestionRow(
						{
							question: data.name,
							marks: question.marks,
						},
						close
					)
				},
				onError(err) {
					showToast(__('Error'), __(err.messages?.[0] || err), 'x')
				},
			}
		)
	}
}

const addQuestionRow = (question, close) => {
	questionRow.submit(
		{
			...question,
		},
		{
			onSuccess() {
				show.value = false
				updateOnboardingStep('create_first_quiz')
				showToast(__('Success'), __('Question added successfully'), 'check')
				quiz.value.reload()
				close()
			},
			onError(err) {
				showToast(__('Error'), __(err.messages?.[0] || err), 'x')
				close()
			},
		}
	)
}

const questionUpdate = createResource({
	url: 'frappe.client.set_value',
	auto: false,
	makeParams(values) {
		return {
			doctype: 'LMS Question',
			name: questionData.data?.name,
			fieldname: {
				...question,
			},
		}
	},
})

const marksUpdate = createResource({
	url: 'frappe.client.set_value',
	auto: false,
	makeParams(values) {
		return {
			doctype: 'LMS Quiz Question',
			name: props.questionDetail.name,
			fieldname: {
				marks: question.marks,
			},
		}
	},
})

const updateQuestion = (close) => {
	questionUpdate.submit(
		{},
		{
			onSuccess() {
				marksUpdate.submit(
					{},
					{
						onSuccess() {
							show.value = false
							showToast(
								__('Success'),
								__('Question updated successfully'),
								'check'
							)
							quiz.value.reload()
							close()
						},
					}
				)
			},
			onError(err) {
				showToast(__('Error'), __(err.messages?.[0] || err), 'x')
			},
		}
	)
}

const dialogOptions = computed(() => {
	return {
		title: __(props.title),
		size: 'xl',
		actions: [
			{
				label: __('Submit'),
				variant: 'solid',
				onClick: (close) => {
					submitQuestion(close)
				},
			},
		],
	}
})
</script>
<style>
input[type='radio']:checked {
	background-color: theme('colors.gray.900') !important;
	border-color: theme('colors.gray.900') !important;
	--tw-ring-color: theme('colors.gray.900') !important;
}
</style>
