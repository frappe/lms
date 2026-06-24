<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-base px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<div v-if="!readOnlyMode" class="flex items-center gap-x-2">
			<Badge v-if="quizDetails.isDirty" theme="orange">
				{{ __('Not Saved') }}
			</Badge>
			<router-link
				v-if="quizDetails.doc?.name"
				:to="{
					name: 'QuizPage',
					params: {
						quizID: quizDetails.doc.name,
					},
				}"
			>
				<Button>
					<template #prefix>
						<span class="lucide-list-checks size-4" />
					</template>
					{{ __('Test Quiz') }}
				</Button>
			</router-link>
			<router-link
				v-if="quizDetails.doc?.name"
				:to="{
					name: 'QuizSubmissionList',
					params: {
						quizID: quizDetails.doc.name,
					},
				}"
			>
				<Button>
					<template #prefix>
						<span class="lucide-clipboard-list size-4" />
					</template>
					{{ __('Check Submissions') }}
				</Button>
			</router-link>
		</div>
	</header>
	<div
		v-if="quizDetails.loading && !quizDetails.doc"
		class="flex items-center justify-center py-20"
	>
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
	<div
		v-else-if="quizDetails.doc"
		class="grid min-h-0 flex-1 grid-cols-[7fr,3fr]"
	>
		<!-- LEFT: Questions -->
		<div class="flex min-h-0 flex-col">
			<div class="flex items-center justify-between px-5 pt-5 mb-4">
				<div class="text-xl-semibold text-ink-gray-9">
					{{ __('Questions') }}
				</div>
				<Button v-if="!readOnlyMode" @click="openQuestionModal()">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('New Question') }}
				</Button>
			</div>
			<ListView
				v-if="questions.length"
				class="flex-1 overflow-y-auto px-5"
				:columns="questionColumns"
				:rows="questions"
				row-key="name"
				:options="{
					showTooltip: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in questionColumns" />
				</ListHeader>
				<ListRows>
					<ListRow
						:row="row"
						v-slot="{ idx, column, item }"
						v-for="row in questions"
						@click="openQuestionModal(row)"
						class="cursor-pointer"
					>
						<ListRowItem :item="item">
							<div
								v-if="column.key == 'question_detail'"
								class="text-xs truncate h-4"
								v-html="sanitizeRichHTML(item)"
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
								<span class="lucide-trash-2 size-4" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
			<EmptyStateLayout
				v-else
				class="flex-1"
				name="Questions"
				:title="__('No questions added yet')"
				:description="__('Add a question to get started.')"
				icon="lucide-circle-help"
			/>
			<ListFooter
				v-model="pageLength"
				class="border-t px-3 py-2 sm:px-5"
				:options="{
					rowCount: questions.length,
					totalCount: questions.length,
				}"
			>
				<template #right>
					<div class="flex items-center gap-1 text-base text-ink-gray-5">
						<div>{{ questions.length }}</div>
						<div>{{ __('of') }}</div>
						<div>{{ questions.length }}</div>
					</div>
				</template>
			</ListFooter>
		</div>

		<!-- RIGHT: Details + Settings -->
		<div class="space-y-8 overflow-y-auto border-l p-5">
			<div class="space-y-5">
				<div class="text-ink-gray-9 font-semibold">{{ __('Details') }}</div>
				<FormControl
					v-model="quizDetails.doc.title"
					:label="__('Title')"
					:required="true"
				/>
				<FormControl
					type="number"
					v-model="quizDetails.doc.max_attempts"
					:label="__('Maximum Attempts')"
				/>
				<FormControl
					type="number"
					v-model="quizDetails.doc.duration"
					:label="__('Duration (in minutes)')"
				/>
				<FormControl
					v-model="quizDetails.doc.total_marks"
					:label="__('Total Marks')"
					disabled
				/>
				<FormControl
					v-model="quizDetails.doc.passing_percentage"
					:label="__('Passing Percentage')"
					:required="true"
				/>
			</div>
			<div class="space-y-5">
				<div class="text-ink-gray-9 font-semibold">{{ __('Settings') }}</div>
				<BooleanSwitch
					v-model="quizDetails.doc.show_answers"
					size="sm"
					:label="__('Show Answers')"
					:description="
						__('Display correct answers after each question is attempted.')
					"
				/>
				<BooleanSwitch
					v-model="quizDetails.doc.show_submission_history"
					size="sm"
					:label="__('Show Submission History')"
					:description="__('Allow users to view their past quiz attempts.')"
				/>
				<BooleanSwitch
					v-model="quizDetails.doc.shuffle_questions"
					size="sm"
					:label="__('Shuffle Questions')"
					:description="
						__('Randomize the order of questions for each attempt.')
					"
				/>
				<FormControl
					v-if="quizDetails.doc.shuffle_questions"
					v-model="quizDetails.doc.limit_questions_to"
					:label="__('Limit Questions To')"
				/>
				<BooleanSwitch
					v-model="quizDetails.doc.enable_negative_marking"
					size="sm"
					:label="__('Enable Negative Marking')"
					:description="__('Deduct marks for incorrect answers.')"
				/>
				<FormControl
					v-if="quizDetails.doc.enable_negative_marking"
					v-model="quizDetails.doc.marks_to_cut"
					:label="__('Marks to Deduct')"
				/>
			</div>
		</div>
	</div>

	<Question
		v-model="showQuestionModal"
		:questionDetail="currentQuestion"
		v-model:quiz="quizDetails"
		:title="currentQuestion.question ? __('Edit Question') : __('Add Question')"
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
	ListFooter,
	Button,
	usePageMeta,
	toast,
	createDocumentResource,
	Badge,
	LoadingIndicator,
} from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import {
	computed,
	reactive,
	ref,
	onMounted,
	inject,
	onBeforeUnmount,
	watch,
} from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { sessionStore } from '../stores/session'

import { useRouter } from 'vue-router'
import { sanitizeHTML } from '@/utils'
import { sanitizeRichHTML } from '@/utils/sanitizeRichHTML'
import Question from '@/components/Modals/Question.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

const { brand } = sessionStore()
const pageLength = ref(20)
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

const questions = computed(() => {
	return quizDetails.doc?.questions || []
})

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
	quizDetails.reload()
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
	// Flush a pending edit that the debounce hasn't fired yet, so navigating
	// away immediately after a change can't drop it.
	if (quizDetails.isDirty) submitQuiz({ silent: true })
})

const quizDetails = createDocumentResource({
	doctype: 'LMS Quiz',
	name: props.quizID,
	auto: false,
})

const validateTitle = () => {
	quizDetails.doc.title = sanitizeHTML(quizDetails.doc.title.trim())
}

// Debounced silent autosave: a burst of edits collapses into a single save
// shortly after the user pauses. `quizDetails.isDirty` is tracked by the
// document resource, so loading the quiz doesn't arm it — only real edits do.
const autoSave = useDebounceFn(() => {
	if (quizDetails.isDirty) submitQuiz({ silent: true })
}, 1000)

watch(
	() => quizDetails.isDirty,
	(dirty) => {
		if (dirty) autoSave()
	}
)

const submitQuiz = (opts = {}) => {
	validateTitle()
	quizDetails.setValue.submit(
		{
			...quizDetails.doc,
			total_marks: calculateTotalMarks(),
		},
		{
			onSuccess(data) {
				quizDetails.doc.total_marks = data.total_marks
				if (!opts.silent) toast.success(__('Quiz updated successfully'))
			},
			onError(err) {
				// Autosave failures stay quiet; the orange "unsaved" badge remains
				// so the change isn't silently lost.
				if (!opts.silent) toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const calculateTotalMarks = () => {
	let totalMarks = 0
	if (
		quizDetails.doc?.limit_questions_to &&
		quizDetails.doc?.questions.length > 0
	)
		return (
			quizDetails.doc.questions[0].marks * quizDetails.doc.limit_questions_to
		)

	quizDetails.doc?.questions.forEach((question) => {
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
		label: quizDetails.doc?.title,
		route: { name: 'QuizForm', params: { quizID: props.quizID } },
	})
	return crumbs
})

usePageMeta(() => {
	return {
		title: quizDetails.doc?.title,
		icon: brand.favicon,
	}
})
</script>
