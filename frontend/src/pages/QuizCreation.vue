<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div class="w-3/4 mx-auto py-5">
		<!-- Details -->
		<div class="mb-8">
			<div class="text-sm font-semibold mb-4">
				{{ __('Details') }}
			</div>
			<div class="grid grid-cols-2 gap-5">
				<div class="space-y-2">
					<FormControl v-model="quiz.title" :label="__('Title')" />
					<FormControl
						v-model="quiz.max_attempts"
						:label="__('Maximun Attempts')"
					/>
					<FormControl
						v-model="quiz.limit_questions_to"
						:label="__('Limit Questions To')"
					/>
				</div>
				<div class="space-y-2">
					<FormControl v-model="quiz.total_marks" :label="__('Total Marks')" />
					<FormControl
						v-model="quiz.passing_percentage"
						:label="__('Passing Percentage')"
					/>
				</div>
			</div>
		</div>

		<!-- Settings -->
		<div class="mb-8">
			<div class="text-sm font-semibold mb-4">
				{{ __('Settings') }}
			</div>
			<div class="grid grid-cols-3 gap-5 my-4">
				<FormControl
					v-model="quiz.show_answers"
					type="checkbox"
					:label="__('Show Answers')"
				/>
				<FormControl
					v-model="quiz.show_submission_history"
					type="checkbox"
					:label="__('Show Submission History')"
				/>
				<FormControl
					v-model="quiz.shuffle_questions"
					type="checkbox"
					:label="__('Shuffle Questions')"
				/>
			</div>
		</div>

		<!-- Questions -->
		<div>
			<div class="flex items-center justify-between mb-4">
				<div class="text-sm font-semibold">
					{{ __('Questions') }}
				</div>
				<Button @click="openQuestionModal()">
					<template #prefix>
						<Plus class="w-4 h-4" />
					</template>
					{{ __('New Question') }}
				</Button>
			</div>
			<ListView
				:columns="questionColumns"
				:rows="quiz.questions"
				row-key="name"
				:options="{
					showTooltip: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in questionColumns" />
				</ListHeader>
				<ListRows>
					<ListRow
						:row="row"
						v-slot="{ idx, column, item }"
						v-for="row in quiz.questions"
						@click="openQuestionModal(row.question)"
					>
						<ListRowItem :item="item">
							<div
								v-if="column.key == 'question_detail'"
								class="text-xs truncate"
							>
								{{ item }}
							</div>
							<div v-else class="text-xs">
								{{ item }}
							</div>
						</ListRowItem>
					</ListRow>
				</ListRows>
			</ListView>
		</div>
	</div>
	<Question v-model="showQuestionModal" :questionName="currentQuestion" />
</template>
<script setup>
import {
	Breadcrumbs,
	createDocumentResource,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Button,
} from 'frappe-ui'
import { computed, reactive, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import Question from '@/components/Modals/Question.vue'

const showQuestionModal = ref(false)
const currentQuestion = ref(null)

const props = defineProps({
	quizID: {
		type: String,
		required: true,
	},
})

const quiz = reactive({
	title: '',
	total_marks: '',
	passing_percentage: '',
	max_attempts: 0,
	limit_questions_to: 0,
	show_answers: true,
	show_submission_history: false,
	shuffle_questions: false,
	questions: [],
})

const quizDetails = createDocumentResource({
	doctype: 'LMS Quiz',
	name: props.quizID,
	auto: true,
	cache: ['quiz', props.quizID],
	onSuccess(data) {
		Object.keys(data).forEach((key) => {
			if (Object.hasOwn(quiz, key)) quiz[key] = data[key]
		})

		let checkboxes = [
			'show_answers',
			'show_submission_history',
			'shuffle_questions',
		]
		for (let idx in checkboxes) {
			let key = checkboxes[idx]
			quiz[key] = quiz[key] ? true : false
		}
	},
})

const questionColumns = computed(() => {
	return [
		{
			label: __('ID'),
			key: 'question',
			width: '25%',
		},
		{
			label: __('Question'),
			key: __('question_detail'),
			width: '60%',
		},
		{
			label: __('Marks'),
			key: 'marks',
			width: '10%',
		},
	]
})

const openQuestionModal = (question = null) => {
	console.log('called')
	console.log(question)
	currentQuestion.value = question
	showQuestionModal.value = true
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('Quizzes'),
			route: {
				name: 'Quizzes',
			},
		},
	]
	return crumbs
})
</script>
