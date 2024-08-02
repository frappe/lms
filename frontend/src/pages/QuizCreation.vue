<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<Button variant="solid" @click="submitQuiz()">
			{{ __('Save') }}
		</Button>
	</header>
	<div class="w-3/4 mx-auto py-5">
		<!-- Details -->
		<div class="mb-8">
			<div class="text-sm font-semibold mb-4">
				{{ __('Details') }}
			</div>
			<FormControl
				v-model="quiz.title"
				:label="
					quizDetails.data?.name
						? __('Title')
						: __('Enter a title and save the quiz to proceed')
				"
			/>
			<div v-if="quizDetails.data?.name">
				<div class="grid grid-cols-2 gap-5 mt-2 mb-8">
					<div class="space-y-2">
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
						<FormControl
							v-model="quiz.total_marks"
							:label="__('Total Marks')"
							disabled
						/>
						<FormControl
							v-model="quiz.passing_percentage"
							:label="__('Passing Percentage')"
						/>
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
		</div>
	</div>
	<Question
		v-model="showQuestionModal"
		:questionName="currentQuestion"
		v-model:quiz="quizDetails"
		:title="
			currentQuestion ? __('Edit the question') : __('Add a new question')
		"
	/>
</template>
<script setup>
import {
	Breadcrumbs,
	createDocumentResource,
	createResource,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Button,
} from 'frappe-ui'
import {
	computed,
	reactive,
	ref,
	onMounted,
	inject,
	onBeforeUnmount,
	watch,
} from 'vue'
import { Plus } from 'lucide-vue-next'
import Question from '@/components/Modals/Question.vue'
import { showToast } from '../utils'
import { useRouter } from 'vue-router'

const showQuestionModal = ref(false)
const currentQuestion = ref(null)
const user = inject('$user')
const router = useRouter()

onMounted(() => {
	if (
		props.quizID == 'new' &&
		!user.data?.is_moderator &&
		!user.data?.is_instructor
	) {
		router.push({ name: 'Courses' })
	}
	if (props.quizID !== 'new') {
		console.log('here')
		quizDetails.reload()
	}
	window.addEventListener('keydown', keyboardShortcut)
})

const keyboardShortcut = (e) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		!e.target.classList.contains('ProseMirror')
	) {
		submitQuiz()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

const props = defineProps({
	quizID: {
		type: String,
		required: true,
	},
})

const quiz = reactive({
	title: '',
	total_marks: 0,
	passing_percentage: 0,
	max_attempts: 0,
	limit_questions_to: 0,
	show_answers: true,
	show_submission_history: false,
	shuffle_questions: false,
	questions: [],
})

const quizDetails = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return { doctype: 'LMS Quiz', name: props.quizID }
	},
	cache: ['quiz', props.quizID],
	auto: false,

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

const quizCreate = createResource({
	url: 'frappe.client.insert',
	auto: false,
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Quiz',
				...quiz,
			},
		}
	},
})

const quizUpdate = createResource({
	url: 'frappe.client.set_value',
	auto: false,
	makeParams(values) {
		return {
			doctype: 'LMS Quiz',
			name: values.quizID,
			fieldname: {
				total_marks: calculateTotalMarks(),
				...quiz,
			},
		}
	},
})

const submitQuiz = () => {
	if (quizDetails.data?.name) updateQuiz()
	else createQuiz()
}

const createQuiz = () => {
	quizCreate.submit(
		{},
		{
			onSuccess(data) {
				showToast(__('Success'), __('Quiz created successfully', 'check'))
				router.push({
					name: 'QuizCreation',
					params: { quizID: data.name },
				})
			},
			onError(err) {
				showToast(__('Error'), __(err.messages?.[0] || err), 'x')
			},
		}
	)
}

const updateQuiz = () => {
	quizUpdate.submit(
		{ quizID: quizDetails.data?.name },
		{
			onSuccess(data) {
				quiz.total_marks = data.total_marks
				showToast(__('Success'), __('Quiz updated successfully'), 'check')
			},
			onError(err) {
				showToast(__('Error'), __(err.messages?.[0] || err), 'x')
			},
		}
	)
}

const calculateTotalMarks = () => {
	let totalMarks = 0
	if (quiz.limit_questions_to && quiz.questions.length > 0)
		return quiz.questions[0].marks * quiz.limit_questions_to
	quiz.questions.forEach((question) => {
		totalMarks += question.marks
	})
	return totalMarks
}

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

watch(
	() => props.quizID !== 'new',
	(newVal) => {
		console.log(props.quizID)
		if (newVal) {
			quizDetails.reload()
		}
	}
)

const openQuestionModal = (question = null) => {
	currentQuestion.value = question
	showQuestionModal.value = true
	console.log(currentQuestion.value)
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
	/* if (quizDetails.data) {
		crumbs.push({
			label: quiz.title,
		})
	} */
	crumbs.push({
		label: props.quizID == 'new' ? 'New Quiz' : quizDetails.data?.title,
		route: { name: 'QuizCreation', params: { quizID: props.quizID } },
	})
	return crumbs
})
</script>
