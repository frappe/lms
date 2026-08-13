<template>
	<PageHeader :breadcrumbs="breadcrumbs" :loading="quizDetails.loading">
		<template #actions>
			<template v-if="!readOnlyMode">
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
					<HeaderButton :label="__('Test Quiz')" icon="lucide-list-checks" />
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
					<HeaderButton
						:label="__('Check Submissions')"
						icon="lucide-clipboard-list"
					/>
				</router-link>
				<HeaderButton
					v-if="quizDetails.doc?.name"
					:label="__('Delete quiz')"
					icon="lucide-trash-2"
					theme="red"
					@click="deleteQuiz"
				/>
			</template>
		</template>
	</PageHeader>
	<div
		v-if="quizDetails.loading && !quizDetails.doc"
		class="flex items-center justify-center py-20"
	>
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
	<div
		v-else-if="quizDetails.doc"
		class="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[7fr,3fr]"
	>
		<div class="flex min-w-0 flex-col lg:min-h-0">
			<div class="flex items-center justify-between px-5 pt-5 mb-4">
				<h2 class="text-lg-semibold text-ink-gray-9">
					{{ __('Questions') }}
				</h2>
				<Button v-if="!readOnlyMode" @click="openQuestion()">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('New Question') }}
				</Button>
			</div>
			<ResponsiveListView
				v-if="questions.length"
				class="px-5 pb-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0"
				:columns="questionColumns"
				:rows="questions"
				row-key="name"
				title-key="question_detail"
				:options="listOptions"
			>
				<template #cell="{ column, value }">
					<div
						v-if="column.key === 'question_detail'"
						class="text-xs [&>*]:inline"
						v-safe-html:rich="value"
					></div>
					<div v-else class="text-xs">
						{{ value }}
					</div>
				</template>
				<template #selection-actions="{ unselectAll, selections }">
					<Button
						variant="ghost"
						:label="__('Delete')"
						@click="deleteQuestions(selections, unselectAll)"
					>
						<template #icon>
							<span class="lucide-trash-2 size-4" />
						</template>
					</Button>
				</template>
			</ResponsiveListView>
			<EmptyStateLayout
				v-else
				class="flex-1"
				name="Questions"
				:title="__('No questions added yet')"
				:description="__('Add a question to get started')"
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

		<div
			class="order-first min-w-0 space-y-8 border-b p-5 lg:order-none lg:overflow-y-auto lg:border-b-0 lg:border-s"
		>
			<div class="space-y-5">
				<h2 class="text-ink-gray-9 font-semibold">{{ __('Details') }}</h2>
				<FormControl
					v-model="quizDetails.doc.title"
					:label="__('Title')"
					variant="outline"
					:required="true"
					autofocus
				/>
				<FormControl
					type="number"
					v-model="quizDetails.doc.max_attempts"
					:label="__('Maximum Attempts')"
					variant="outline"
				/>
				<FormControl
					type="number"
					v-model="quizDetails.doc.duration"
					:label="__('Duration (in minutes)')"
					variant="outline"
				/>
				<FormControl
					v-model="quizDetails.doc.total_marks"
					variant="outline"
					disabled
				>
					<template #label>
						<div class="flex items-center gap-1.5">
							<span>{{ __('Total Marks') }}</span>
							<Tooltip
								:text="
									__(`Auto-filled based on the sum of all questions' marks.`)
								"
							>
								<span
									class="lucide-help-circle size-4 shrink-0 text-ink-gray-5"
								/>
							</Tooltip>
						</div>
					</template>
				</FormControl>
				<FormControl
					v-model="quizDetails.doc.passing_percentage"
					:label="__('Passing Percentage')"
					variant="outline"
					:required="true"
				/>
			</div>
			<div class="space-y-5">
				<h2 class="text-ink-gray-9 font-semibold">{{ __('Settings') }}</h2>
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
					variant="outline"
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
					variant="outline"
				/>
			</div>
		</div>
	</div>

	<router-view :key="route.params.questionName" />
</template>
<script setup>
import {
	createResource,
	FormControl,
	ListFooter,
	Button,
	usePageMeta,
	toast,
	createDocumentResource,
	Badge,
	LoadingIndicator,
	Tooltip,
} from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import {
	computed,
	ref,
	onMounted,
	inject,
	onBeforeUnmount,
	watch,
	getCurrentInstance,
} from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
	useKeyboardShortcuts,
	saveShortcut,
} from '@/composables/useKeyboardShortcuts'
import { sessionStore } from '@/stores/session'

import { useRoute, useRouter } from 'vue-router'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import { openFormRoute } from '@/composables/useFormRoute'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import { submitResource } from '@/utils/resource'

const { brand } = sessionStore()
const pageLength = ref(20)
const user = inject('$user')
const route = useRoute()
const router = useRouter()
const readOnlyMode = window.read_only_mode
const { $dialog } = getCurrentInstance().appContext.config.globalProperties

const deleteQuiz = () => {
	$dialog({
		title: __('Delete this quiz?'),
		message: __(
			'Deleting this quiz permanently removes it and its submissions. This action cannot be undone. Are you sure you want to continue?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }) {
					quizDetails.delete
						.submit()
						.then(() => {
							toast.success(__('Quiz deleted successfully'))
							router.push({ name: 'Quizzes' })
						})
						.catch((err) => {
							toast.error(err.messages?.[0] || __('Could not delete the quiz'))
						})
					close()
				},
			},
		],
	})
}

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
})

// ignoreTyping: false so Cmd/Ctrl+S saves even while the cursor is in a field.
useKeyboardShortcuts({
	ignoreTyping: false,
	shortcuts: [saveShortcut(() => submitQuiz())],
})

onBeforeUnmount(() => {
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
	quizDetails.doc.title = sanitizeOnWrite(quizDetails.doc.title.trim())
}

// Debounced silent autosave: a burst of edits collapses into a single save
// shortly after the user pauses. `quizDetails.isDirty` is tracked by the
// document resource, so loading the quiz doesn't arm it; only real edits do.
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
	// Nothing to save once the quiz has been deleted (doc is null). Guard so the
	// autosave watcher and the onBeforeUnmount flush can't throw or re-insert it.
	if (!quizDetails.doc) return
	validateTitle()
	submitResource(
		quizDetails.setValue,
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
			width: 2,
		},
		{
			label: __('Question'),
			key: 'question_detail',
			width: 8,
		},
		{
			label: __('Marks'),
			key: 'marks',
			width: 1,
		},
	]
})

const listOptions = computed(() => {
	return {
		showTooltip: false,
		selectable: true,
		onRowClick: (row) => openQuestion(row.name),
	}
})

// `questionName` is the LMS Quiz Question ROW name (row.name), not the LMS
// Question docname (row.question) — marks lives on the row and is otherwise
// unrecoverable from the URL. See design R2.
// openFormRoute, not a bare router.push: it stamps the history entry so the
// form's own close() knows to pop it instead of replacing back to this page.
const openQuestion = (questionName = 'new') => {
	openFormRoute(router, {
		name: 'QuizQuestion',
		params: { quizID: props.quizID, questionName },
	})
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
	submitResource(
		deleteQuestionResource,
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
	const crumbs = [
		{
			label: __('Quizzes'),
			route: {
				name: 'Quizzes',
			},
		},
	]

	if (quizDetails.doc?.title) {
		crumbs.push({
			label: quizDetails.doc.title,
			route: { name: 'QuizForm', params: { quizID: props.quizID } },
		})
	}
	return crumbs
})

usePageMeta(() => {
	return {
		title: quizDetails.doc?.title,
		icon: brand.favicon,
	}
})
</script>
