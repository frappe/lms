<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<div v-if="!readOnlyMode" class="space-x-2">
			<router-link
				v-if="quizDetails.data?.name"
				:to="{
					name: 'QuizPage',
					params: {
						quizID: quizDetails.data.name,
					},
				}"
			>
				<Button>
					{{ __('Open') }}
				</Button>
			</router-link>
			<router-link
				v-if="quizDetails.data?.name"
				:to="{
					name: 'QuizSubmissionList',
					params: {
						quizID: quizDetails.data.name,
					},
				}"
			>
				<Button>
					{{ __('Submission List') }}
				</Button>
			</router-link>
			<Button variant="solid" @click="submitQuiz()">
				{{ __('Save') }}
			</Button>
		</div>
	</header>
	<div class="w-3/4 mx-auto py-5">
		<!-- Details -->
		<div class="mb-8">
			<div class="font-semibold text-ink-gray-9 mb-4">
				{{ __('Details') }}
			</div>
			<FormControl
				v-model="quiz.title"
				:label="
					quizDetails.data?.name
						? __('Title')
						: __('Enter a title and save the quiz to proceed')
				"
				:required="true"
			/>
			<div v-if="quizDetails.data?.name">
				<div class="grid grid-cols-2 gap-5 mt-4 mb-8">
					<FormControl
						type="number"
						v-model="quiz.max_attempts"
						:label="__('Maximum Attempts')"
					/>
					<FormControl
						type="number"
						v-model="quiz.duration"
						:label="__('Duration (in minutes)')"
					/>
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

				<!-- Settings -->
				<div class="mb-8">
					<div class="font-semibold text-ink-gray-9 mb-4">
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
					</div>
				</div>

				<div class="mb-8">
					<div class="font-semibold text-ink-gray-9 mb-4">
						{{ __('Shuffle Settings') }}
					</div>
					<div class="grid grid-cols-3">
						<FormControl
							v-model="quiz.shuffle_questions"
							type="checkbox"
							:label="__('Shuffle Questions')"
						/>
						<FormControl
							v-if="quiz.shuffle_questions"
							v-model="quiz.limit_questions_to"
							:label="__('Limit Questions To')"
						/>
					</div>
				</div>

				<!-- Questions -->
				<div>
					<div class="flex items-center justify-between mb-4">
						<div class="font-semibold text-ink-gray-9">
							{{ __('Questions') }}
						</div>
						<Button v-if="!readOnlyMode" @click="openQuestionModal()">
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
							class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
						>
							<ListHeaderItem :item="item" v-for="item in questionColumns" />
						</ListHeader>
						<ListRows>
							<ListRow
								:row="row"
								v-slot="{ idx, column, item }"
								v-for="row in quiz.questions"
								@click="openQuestionModal(row)"
								class="cursor-pointer"
							>
								<ListRowItem :item="item">
									<div
										v-if="column.key == 'question_detail'"
										class="text-xs truncate h-4"
										v-html="item"
									></div>
									<div v-else class="text-xs">
										{{ item }}
									</div>
								</ListRowItem>
							</ListRow>
						</ListRows>
						<ListSelectBanner>
							<template #actions="{ unselectAll, selections }">
								<div class="flex gap-2">
									<Button
										variant="ghost"
										@click="deleteQuestions(selections, unselectAll)"
									>
										<Trash2 class="h-4 w-4 stroke-1.5" />
									</Button>
								</div>
							</template>
						</ListSelectBanner>
					</ListView>
				</div>
			</div>
		</div>
	</div>
	<Question
		v-model="showQuestionModal"
		:questionDetail="currentQuestion"
		v-model:quiz="quizDetails"
		:title="
			currentQuestion.question
				? __('Edit the question')
				: __('Add a new question')
		"
	/>
</template>
<script setup>
import {
	Breadcrumbs,
	createResource,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	Button,
	usePageMeta,
	toast,
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
import { sessionStore } from '../stores/session'
import { Plus, Trash2 } from 'lucide-vue-next'
import { updateDocumentTitle } from '@/utils'
import { useRouter } from 'vue-router'
import Question from '@/components/Modals/Question.vue'

const { brand } = sessionStore()
const showQuestionModal = ref(false)
const currentQuestion = reactive({
	question: '',
	marks: 0,
	name: '',
})
const user = inject('$user')
const router = useRouter()
const readOnlyMode = window.read_only_mode

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
	duration: 0,
	limit_questions_to: 0,
	show_answers: true,
	show_submission_history: false,
	shuffle_questions: false,
	questions: [],
})

onMounted(() => {
	if (
		props.quizID == 'new' &&
		!user.data?.is_moderator &&
		!user.data?.is_instructor
	) {
		router.push({ name: 'Courses' })
	}
	if (props.quizID !== 'new') {
		quizDetails.reload()
	}
	window.addEventListener('keydown', keyboardShortcut)
})

const keyboardShortcut = (e) => {
	if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
		submitQuiz()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

watch(
	() => props.quizID !== 'new',
	(newVal) => {
		if (newVal) {
			quizDetails.reload()
		}
	}
)

const quizDetails = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return { doctype: 'LMS Quiz', name: props.quizID }
	},
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
				toast.success(__('Quiz created successfully'))
				router.push({
					name: 'QuizForm',
					params: { quizID: data.name },
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
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
				toast.success(__('Quiz updated successfully'))
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
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
			width: '10rem',
		},
		{
			label: __('Question'),
			key: __('question_detail'),
			width: '40rem',
		},
		{
			label: __('Marks'),
			key: 'marks',
			width: '5rem',
		},
	]
})

const openQuestionModal = (question = null) => {
	if (question) {
		currentQuestion.question = question.question
		currentQuestion.marks = question.marks
		currentQuestion.name = question.name
	} else {
		currentQuestion.question = ''
		currentQuestion.marks = 0
		currentQuestion.name = ''
	}
	showQuestionModal.value = true
}

const deleteQuestionResource = createResource({
	url: 'lms.lms.api.delete_documents',
	makeParams(values) {
		return {
			doctype: 'LMS Quiz Question',
			documents: values.questions,
		}
	},
})

const deleteQuestions = (selections, unselectAll) => {
	deleteQuestionResource.submit(
		{
			questions: Array.from(selections),
		},
		{
			onSuccess() {
				toast.success(__('Questions deleted successfully'))
				quizDetails.reload()
				unselectAll()
			},
		}
	)
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

	crumbs.push({
		label: props.quizID == 'new' ? __('New Quiz') : quizDetails.data?.title,
		route: { name: 'QuizForm', params: { quizID: props.quizID } },
	})
	return crumbs
})

usePageMeta(() => {
	return {
		title: props.quizID == 'new' ? __('New Quiz') : quizDetails.data?.title,
		icon: brand.favicon,
	}
})
</script>
