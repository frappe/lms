<template>
	<Dialog v-model="show" :options="dialogOptions">
		<template #body-content>
			<div class="space-y-4">
				<div>
					<label class="block text-xs text-gray-600 mb-1">
						{{ __('Question') }}
					</label>
					<TextEditor
						:content="question.question"
						@change="(val) => (question.question = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
				<FormControl
					:label="__('Type')"
					v-model="question.type"
					type="select"
					:options="['Choices', 'User Input']"
					class="pb-2"
				/>
				<div v-if="question.type == 'Choices'" class="divide-y">
					<div v-for="n in 4" class="space-y-4 py-2">
						<FormControl
							:label="__('Option') + ' ' + n"
							v-model="question[`option_${n}`]"
						/>
						<FormControl
							:label="__('Explanation')"
							v-model="question[`explanation_${n}`]"
						/>
						<FormControl
							:label="__('Correct Answer')"
							v-model="question[`correct_answer_${n}`]"
							type="checkbox"
						/>
					</div>
				</div>
				<div v-else v-for="n in 4" class="space-y-2">
					<FormControl
						:label="__('Possibility') + ' ' + n"
						v-model="question[`possibility_${n}`]"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl, TextEditor } from 'frappe-ui'
import { computed, onMounted, reactive } from 'vue'

const show = defineModel()
const question = reactive({
	question: '',
	type: 'Choices',
})

onMounted(() => {
	populateFields()
	populateQuestionDetail()
})

const props = defineProps({
	title: {
		type: String,
		default: __('Add a Question'),
	},
	questionDetail: {
		type: Object,
		default: {},
	},
})

const populateFields = () => {
	let fields = ['option', 'correct_answer', 'explanation', 'possibility']
	let counter = 1
	fields.forEach((field) => {
		while (counter <= 4) {
			question[`${field}_${counter}`] = field === 'correct_answer' ? false : ''
			counter++
		}
	})
}

const populateQuestionDetail = () => {
	if (Object.keys(props.questionDetail).length) {
		Object.keys(props.questionDetail).forEach((key) => {
			if (Object.hasOwn(question, key)) {
				question[key] = props.questionDetail[key]
			}
		})
	}
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
