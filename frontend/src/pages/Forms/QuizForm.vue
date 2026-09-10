<template>
	<PageHeader :breadcrumbs="breadcrumbs" :loading="quizDetails.loading">
		<template #actions>
			<template v-if="!readOnlyMode">
				<Badge v-if="doc?.name" :theme="hasUnsavedWork ? 'amber' : 'green'">
					{{ hasUnsavedWork ? __('Not saved') : __('Saved') }}
				</Badge>
				<template v-if="doc?.name">
					<HeaderButton
						variant="subtle"
						icon="lucide-eye"
						:label="previewLabel"
						:aria-pressed="previewing"
						:disabled="!previewing && (!!draft || dirtyCardNames.size > 0)"
						@click="togglePreview"
					/>
					<HeaderButton
						variant="subtle"
						icon="lucide-clipboard-list"
						:label="__('Submissions')"
						@click="goToSubmissions"
					/>
					<HeaderButton
						variant="subtle"
						theme="red"
						icon="lucide-trash-2"
						:label="__('Delete')"
						@click="deleteQuiz"
					/>
				</template>
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
		v-else-if="doc"
		class="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[7fr,3fr]"
	>
		<div class="flex min-h-0 flex-col overflow-y-auto px-5 py-5">
			<div
				v-if="previewing"
				data-testid="quiz-preview"
				class="mx-auto w-full max-w-2xl"
			>
				<Quiz :quizName="quizDetails.doc.name" preview />
			</div>
			<template v-else>
				<div
					v-if="!readOnlyMode"
					class="mb-5 flex items-center gap-3"
					data-testid="question-toolbar"
				>
					<FormControl
						class="flex-1"
						type="text"
						:disabled="isNew"
						v-model="searchQuery"
						:placeholder="__('Search questions')"
						:aria-label="__('Search questions')"
					>
						<template #prefix
							><span class="lucide-search size-4 text-ink-gray-5"
						/></template>
					</FormControl>
					<div class="flex shrink-0 items-center gap-2">
						<Button
							variant="subtle"
							:disabled="isNew || bankOpen"
							@click="addBlankQuestion"
						>
							<template #prefix><span class="lucide-plus size-4" /></template>
							{{ __('New question') }}
						</Button>
						<Button
							variant="subtle"
							:disabled="isNew || (bankOpen && !bankSelectionCount)"
							@click="bankOpen ? addSelectedFromBank() : openBank()"
						>
							<template #prefix
								><span class="lucide-library size-4"
							/></template>
							{{ bankOpen ? __('Add questions') : __('Question bank') }}
						</Button>
					</div>
				</div>

				<EmptyStateLayout
					v-if="isNew"
					data-testid="quiz-unnamed-state"
					class="flex-1"
					name="Quiz"
					icon="lucide-pencil-line"
					:title="__('Name the quiz first')"
					:description="
						__(
							'Fill in the title on the right. The quiz is created then, and questions can go in.'
						)
					"
				/>

				<Alert
					v-else-if="showOpenEndedNotice"
					class="mb-5"
					theme="yellow"
					:title="__('Manual grading')"
					@dismiss="dismissOpenEndedNotice"
				>
					<template #description>
						<p class="text-ink-gray-7">
							{{
								__(
									'Students answer in a rich-text editor (image embeds allowed).'
								)
							}}
							{{
								__(
									"An open-ended question can't be mixed with other types, and live answer-reveal is turned off for this quiz."
								)
							}}
						</p>
						<router-link
							class="font-medium text-ink-gray-8 underline underline-offset-2"
							:to="{
								name: 'QuizSubmissions',
								query: { quiz: quizDetails.doc.name },
							}"
						>
							{{ __('Grade submissions') }}
						</router-link>
					</template>
				</Alert>

				<EmptyStateLayout
					v-if="!isNew && !questions.length && !draft"
					class="flex-1"
					name="Questions"
					icon="lucide-circle-dot"
					:title="__('No questions yet')"
					:description="
						__(
							'Add your first question and edit it right here. Choices, correct answers and explanations all in one card.'
						)
					"
				>
					<Button variant="subtle" @click="addBlankQuestion">
						<template #prefix><span class="lucide-plus size-4" /></template>
						{{ __('New question') }}
					</Button>
				</EmptyStateLayout>

				<template v-else-if="!isNew">
					<Draggable
						:list="quizDetails.doc.questions"
						item-key="name"
						handle=".drag-handle"
						class="space-y-3"
						:disabled="reorderDisabled"
					>
						<template #item="{ element, index }">
							<div v-show="matchesSearch(element)">
								<QuestionCard
									:row="element"
									:index="index"
									:quizName="quizDetails.doc.name"
									:editing="editingNames.has(element.name)"
									:reorderDisabled="reorderDisabled"
									:usageCount="questionMeta[element.question]?.quizzes || 1"
									:meta="questionMeta[element.question] || null"
									:readOnly="readOnlyMode"
									:allowedUiTypes="allowedUiTypesFor(typeRows, element.name)"
									@edit="openCard(element)"
									@done="closeCard(element.name)"
									@dirty-change="setCardDirty(element, $event)"
									@changed="applyQuestionChange(element, $event)"
									@deleted="removeQuestion(element)"
									@duplicated="duplicateQuestion(element, $event)"
								/>
							</div>
						</template>
					</Draggable>

					<div v-if="draft" class="mt-3" data-testid="draft-card">
						<QuestionCard
							:row="draft"
							:index="questions.length"
							:quizName="quizDetails.doc.name"
							:draft="true"
							:allowedUiTypes="allowedUiTypesFor(typeRows, draft.name)"
							:persisting="persisting"
							@request-persist="persistDraft"
							@draft-discarded="discardDraft"
							@type-changed="onDraftTypeChanged"
						/>
					</div>
				</template>
			</template>
		</div>

		<div
			id="quiz-details-panel"
			class="order-first min-w-0 border-b lg:order-none lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-s"
		>
			<QuestionBankPanel
				v-if="rightPanel === 'bank' && doc?.name"
				ref="bankPanel"
				:quizName="quizDetails.doc.name"
				:initialType="hasOpenEnded ? 'Open Ended' : ''"
				:inQuizQuestionNames="questions.map((r) => r.question)"
				:allowedTypes="allowedQuestionTypesFor(typeRows)"
				@added="addQuestionsFromBank"
				@selection-change="bankSelectionCount = $event"
				@close="closeBank"
			/>
			<div v-else class="space-y-8 p-5">
				<div class="space-y-5">
					<h2 class="text-lg font-semibold text-ink-gray-9">
						{{ __('Details') }}
					</h2>
					<FormControl
						v-model="doc.title"
						:label="__('Title')"
						variant="outline"
						:required="true"
						autofocus
						@blur="createIfNamed"
						@keydown.enter.prevent="createIfNamed"
					/>
					<FormControl
						type="number"
						v-model="doc.max_attempts"
						:label="__('Maximum Attempts')"
						variant="outline"
					/>
					<FormControl
						type="number"
						v-model="doc.duration"
						:label="__('Duration (in minutes)')"
						variant="outline"
					/>
					<FormControl
						v-model="doc.passing_percentage"
						:label="__('Passing Percentage')"
						variant="outline"
						:required="true"
					/>
					<FormControl
						:model-value="questions.length"
						:label="__('Total Questions')"
						variant="outline"
						disabled
					/>
					<FormControl
						v-model="doc.total_marks"
						:label="__('Total Marks')"
						variant="outline"
						disabled
					/>
				</div>
				<div class="space-y-5">
					<h2 class="text-lg font-semibold text-ink-gray-9">
						{{ __('Settings') }}
					</h2>
					<BooleanSwitch
						v-model="doc.show_answers"
						size="sm"
						:label="__('Show Answers')"
						:description="
							__('Display correct answers after each question is attempted.')
						"
					/>
					<BooleanSwitch
						v-model="doc.show_submission_history"
						size="sm"
						:label="__('Show Submission History')"
						:description="__('Allow users to view their past quiz attempts.')"
					/>
					<BooleanSwitch
						v-model="doc.shuffle_questions"
						size="sm"
						:label="__('Shuffle Questions')"
						:description="
							__('Randomize the order of questions for each attempt.')
						"
					/>
					<FormControl
						v-if="doc.shuffle_questions"
						v-model="doc.limit_questions_to"
						:label="__('Limit Questions To')"
						variant="outline"
					/>
					<BooleanSwitch
						v-model="doc.enable_negative_marking"
						size="sm"
						:label="__('Enable Negative Marking')"
						:description="__('Deduct marks for incorrect answers.')"
					/>
					<FormControl
						v-if="doc.enable_negative_marking"
						v-model="doc.marks_to_cut"
						:label="__('Marks to Deduct')"
						variant="outline"
					/>
					<BooleanSwitch
						v-model="doc.enable_proctoring"
						size="sm"
						:label="__('Enable Proctoring')"
						:description="
							__(
								'Require camera access and monitor for violations during the quiz.'
							)
						"
					/>
					<FormControl
						v-if="doc.enable_proctoring"
						type="number"
						v-model="doc.max_violations"
						:label="__('Max Violations')"
						:description="
							__('Quiz auto-submits when this many violations are recorded.')
						"
						variant="outline"
						:required="true"
					/>
					<BooleanSwitch
						v-model="doc.enable_scheduling"
						size="sm"
						:label="__('Enable Scheduling')"
						:description="
							__('Restrict when learners can start and submit this quiz.')
						"
					/>
					<FormControl
						v-if="doc.enable_scheduling"
						type="datetime-local"
						:model-value="toDatetimeLocal(doc.schedule_start)"
						@update:model-value="
							(val) => (doc.schedule_start = fromDatetimeLocal(val))
						"
						:label="__('Schedule Start')"
						variant="outline"
						:required="true"
					/>
					<FormControl
						v-if="doc.enable_scheduling"
						type="datetime-local"
						:model-value="toDatetimeLocal(doc.schedule_end)"
						@update:model-value="
							(val) => (doc.schedule_end = fromDatetimeLocal(val))
						"
						:label="__('Schedule End')"
						:description="
							__('Optional. Leave empty to keep the quiz open after it starts.')
						"
						variant="outline"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Alert,
	createResource,
	FormControl,
	Button,
	usePageMeta,
	toast,
	createDocumentResource,
	Badge,
	LoadingIndicator,
} from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import { toDatetimeLocal, fromDatetimeLocal } from '@/utils/schedule'
import Draggable from 'vuedraggable'
import QuestionCard from '@/components/Quiz/QuestionCard.vue'
import QuestionBankPanel from '@/components/Quiz/QuestionBankPanel.vue'
import Quiz from '@/components/Quiz.vue'
import {
	allowedUiTypesFor,
	allowedQuestionTypesFor,
	nextQuestionUiType,
	toBackendType,
	toUiType,
} from '@/utils/quizQuestion'
import {
	computed,
	reactive,
	ref,
	shallowRef,
	onMounted,
	onUnmounted,
	inject,
	watch,
	getCurrentInstance,
} from 'vue'
import {
	useKeyboardShortcuts,
	saveShortcut,
} from '@/composables/useKeyboardShortcuts'
import { sessionStore } from '@/stores/session'
import { useDebounceFn } from '@vueuse/core'

import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import { useTelemetry } from 'frappe-ui/frappe'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

const { brand } = sessionStore()
const rightPanel = ref('settings') // 'settings' | 'bank'
const bankOpen = computed(() => rightPanel.value === 'bank')

// The toolbar drives the panel through its exposed method. `close` is the single way out.
const bankPanel = ref(null)
// The panel is v-if'd, so the count has to be dropped with it, or Add questions
// comes back live over an empty selection.
const bankSelectionCount = ref(0)

const openBank = () => {
	bankSelectionCount.value = 0
	rightPanel.value = 'bank'
}

const closeBank = () => {
	bankSelectionCount.value = 0
	rightPanel.value = 'settings'
}

const addSelectedFromBank = () => bankPanel.value?.addSelected()

// The draft lives here, never in doc.questions, which reload and setValue replace wholesale.
const draft = ref(null)

// Not a sentinel. QuestionCard derives its DOM ids from row.name, so a draft needs one.
const DRAFT_ROW_NAME = 'new-question'

// Real rows only, and a Set, because closing card B must not close card A.
const editingNames = reactive(new Set())

// An open card's edits live in its own object, so the badge and leave guard read them here.
const dirtyCardNames = reactive(new Set())

// Opens asked for mid-save wait for the response, which would unmount the new
// editor. Keyed by row name: a locally added row's synthetic name is replaced
// by the save before the flush.
const pendingCardOpens = new Map()
// Local rows get frappe's unsaved-child name for keying only. savedQuestions() strips it.
let newRowCount = 0
const newRowName = () => `new-lms-quiz-question-${++newRowCount}`

const searchQuery = ref('')
const questionMeta = ref({})
const user = inject('$user')
const router = useRouter()
const readOnlyMode = window.read_only_mode
const { capture } = useTelemetry()
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
					quizDetails.value.delete
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
		default: '',
	},
})

// A quiz takes its docname from its title, so nothing is written until the author
// has given it one. Until then the fields edit this object and no doc exists.
const isNew = computed(() => !props.quizID)
const newQuiz = reactive({ title: '', passing_percentage: 100 })
const doc = computed(() => (isNew.value ? newQuiz : quizDetails.value.doc))

const questions = computed(() => {
	return quizDetails.value.doc?.questions || []
})

// idx is renumbered by position, because append() keeps whatever idx it is handed.
// An invented name is stripped, or _init_child updates a child row that does not exist.
const savedQuestions = () =>
	questions.value.map(({ name, ...rest }, position) => {
		const row = { ...rest, idx: position + 1 }
		if (name && !name.startsWith('new-')) row.name = name
		return row
	})

// setValue replaces doc wholesale and unmounts every open editor, so a save waits for them.
const canSave = computed(
	() =>
		!readOnlyMode &&
		quizDetails.value.isDirty &&
		!draft.value &&
		editingNames.size === 0
)

// After a delete, doc is null while originalDoc is not, so isDirty alone would prompt.
// The draft counts on its own, because it lives outside the doc and may not have dirtied it.
const hasUnsavedWork = computed(
	() =>
		!!quizDetails.value.doc &&
		(quizDetails.value.isDirty || !!draft.value || dirtyCardNames.size > 0)
)

const openCard = (row) => {
	if (saveInFlight) pendingCardOpens.set(row.name, row.question)
	else editingNames.add(row.name)
}

// One place for the per-card lifecycle, so a row is never in one set and not the others.
const closeCard = (name) => {
	editingNames.delete(name)
	pendingCardOpens.delete(name)
	dirtyCardNames.delete(name)
}

const setCardDirty = (row, isDirty) => {
	if (isDirty) dirtyCardNames.add(row.name)
	else dirtyCardNames.delete(row.name)
}

// Runs once the save settles, landed or failed, because a failure must not eat the click.
const flushPendingCardOpens = () => {
	for (const [name, question] of pendingCardOpens) {
		// The row may have been deleted mid-request, and a name addressing nothing locks the page.
		const row =
			questions.value.find((r) => r.name === name) ??
			(question && questions.value.find((r) => r.question === question))
		if (row) editingNames.add(row.name)
	}
	pendingCardOpens.clear()
}

// Reorder is locked while any card is open, or a drop reindexes underneath it.
const reorderDisabled = computed(() => editingNames.size > 0 || !!draft.value)

// True for the round trip that turns a draft into a question, so a double click cannot insert twice.
const persisting = ref(false)

// The mixing rule covers the whole quiz, so an open draft counts before it is persisted.
const typeRows = computed(() =>
	draft.value ? [...questions.value, draft.value] : questions.value
)

const hasOpenEnded = computed(() =>
	typeRows.value.some((row) => toUiType(row) === 'open_ended')
)

// Session-scoped, keyed on props.quizID, computed rather than read once: this
// page is patched, not remounted, when the insert replaces /quizzes/new.
// sessionStorage throws when site data is blocked.
const noticeDismissalKey = computed(
	() => `lms:quiz:${props.quizID}:open-ended-notice-dismissed`
)

const readNoticeDismissal = (key) => {
	try {
		return sessionStorage.getItem(key) === 'true'
	} catch {
		return false
	}
}

const openEndedNoticeDismissed = ref(
	readNoticeDismissal(noticeDismissalKey.value)
)

// The key changes once, when the insert names the quiz, and this page is patched
// rather than remounted, so the flag has to be re-read against the real quiz.
watch(noticeDismissalKey, (key) => {
	openEndedNoticeDismissed.value = readNoticeDismissal(key)
})

const dismissOpenEndedNotice = () => {
	openEndedNoticeDismissed.value = true
	try {
		sessionStorage.setItem(noticeDismissalKey.value, 'true')
	} catch {
		// Hidden either way. A storage failure costs the memory of it, not the dismissal.
	}
}

// Once the quiz has no open-ended question, a later one gets a fresh banner.
const forgetOpenEndedDismissal = () => {
	openEndedNoticeDismissed.value = false
	try {
		sessionStorage.removeItem(noticeDismissalKey.value)
	} catch {
		// Nothing to undo: the ref above is what the render reads.
	}
}

const showOpenEndedNotice = computed(
	() => hasOpenEnded.value && !openEndedNoticeDismissed.value
)

// Preview swaps in the same <Quiz> a learner sees, which reads the saved quiz off the server.
// Anything the form is still holding is saved first, or the preview is a version behind.
const previewing = ref(false)
const previewLabel = computed(() =>
	previewing.value ? __('Close preview') : __('Preview')
)
const togglePreview = async () => {
	if (previewing.value) {
		previewing.value = false
		return
	}
	// closeCard only drops the row from the parent's sets; the card's Close
	// reverts `working`, so closing or unmounting a card with edits discards them.
	// Preview may not do that for the author.
	if (dirtyCardNames.size) return
	// The preview reads the SAVED quiz, and submitQuiz refuses while a card is open,
	// so close them first rather than previewing a version the author cannot see.
	for (const name of Array.from(editingNames)) closeCard(name)
	await submitQuiz({ notify: false })
	// A save that failed leaves the doc dirty, and submitQuiz resolves either way, so
	// without this the preview opens on last-saved content. Its own error toast is the
	// message; an open draft is held off by the button's own disabled state.
	if (hasUnsavedWork.value) return
	// v-if, not v-show: <Quiz> fetches on mount, so a hidden instance would go stale.
	previewing.value = true
}

// The cross-quiz list with this quiz's filter applied, not the per-quiz page: the
// filters are right there, so the author can widen the view without going back.
const goToSubmissions = () =>
	router.push({
		name: 'QuizSubmissions',
		query: { quiz: quizDetails.value.doc.name },
	})

const matchesSearch = (row) => {
	if (!searchQuery.value) return true
	const q = searchQuery.value.toLowerCase()
	return (row.question_detail || '').toLowerCase().includes(q)
}

const questionMetaResource = createResource({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.get_question_meta',
	auto: false,
	onSuccess(data) {
		questionMeta.value = data || {}
	},
})

const refreshQuestionMeta = () => {
	const names = (quizDetails.value.doc?.questions || []).map((q) => q.question)
	if (names.length)
		questionMetaResource.submit({ questions: JSON.stringify(names) })
	else questionMeta.value = {}
}

// Edited in place and local until Save. A reload would drop rows the server has not seen.
const localRow = ({ question, marks, type, multiple, question_detail }) => ({
	name: newRowName(),
	question,
	marks: marks ?? 1,
	type,
	multiple,
	question_detail,
})

const removeQuestion = (row) => {
	const position = questions.value.indexOf(row)
	if (position === -1) return
	quizDetails.value.doc.questions.splice(position, 1)
	// Or the deleted row's name sits in the sets forever and locks reorder and Save.
	closeCard(row.name)
	refreshQuestionMeta()
}

// Directly after its source. A copy eight rows down reads as a different question.
const duplicateQuestion = (row, payload) => {
	const position = questions.value.indexOf(row)
	if (position === -1) return
	quizDetails.value.doc.questions.splice(position + 1, 0, localRow(payload))
	refreshQuestionMeta()
}

// Written in place so the row reads true with no refetch. Undefined is skipped, never assigned.
const applyQuestionChange = (row, changes = {}) => {
	for (const field of ['marks', 'question_detail', 'type', 'multiple'])
		if (changes[field] !== undefined) row[field] = changes[field]
	refreshQuestionMeta()
}

const addQuestionsFromBank = (added = []) => {
	for (const payload of added)
		quizDetails.value.doc.questions.push(localRow(payload))
	refreshQuestionMeta()
}

// Writes nothing. The draft is local until the card asks to be persisted.
const addBlankQuestion = () => {
	if (!quizDetails.value.doc) return
	if (draft.value) return
	draft.value = {
		name: DRAFT_ROW_NAME,
		question: null,
		marks: 1,
		type: toBackendType(nextQuestionUiType(questions.value)).type,
		question_detail: '',
	}
}

// The card owns the type while open, and this mirror keeps hasOpenEnded right meanwhile.
const onDraftTypeChanged = ({ type, multiple }) => {
	if (!draft.value) return
	draft.value.type = type
	draft.value.multiple = multiple
}

// Writes the bank record only. The quiz's own row stays local until the next save.
const persistDraft = async ({ question_doc, marks }) => {
	if (persisting.value) return
	persisting.value = true
	try {
		const created = await createResource({
			url: 'frappe.client.insert',
			auto: false,
		}).submit({ doc: { doctype: 'LMS Question', ...question_doc } })
		quizDetails.value.doc.questions.push(
			localRow({
				question: created.name,
				marks,
				type: draft.value?.type,
				multiple: draft.value?.multiple,
				question_detail: question_doc.question,
			})
		)
		// Cleared only once the insert lands, so a failure leaves the typing on screen.
		draft.value = null
		refreshQuestionMeta()
	} catch (err) {
		toast.error(err.messages?.[0] || err)
	} finally {
		persisting.value = false
	}
}

const discardDraft = () => {
	draft.value = null
}

// The question set is local, so leaving throws it away. This covers in-app navigation.
let leavingWithoutSaving = false

onBeforeRouteLeave((to) => {
	if (leavingWithoutSaving || !hasUnsavedWork.value) return true

	// Cancel first, then re-issue from the button: createDialog reports no dismissal.
	$dialog({
		title: __('Leave without saving?'),
		message: __(
			'The questions you have added, removed or reordered are not saved yet. Leaving this page discards them.'
		),
		actions: [
			{
				label: __('Discard changes'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }) {
					leavingWithoutSaving = true
					close()
					router.push(to).catch(() => {
						leavingWithoutSaving = false
					})
				},
			},
			{
				label: __('Keep editing'),
				onClick({ close }) {
					close()
				},
			},
		],
	})
	return false
})

// The browser writes the text. Both calls are needed for the prompt to appear at all.
const warnOnUnload = (event) => {
	if (!hasUnsavedWork.value) return
	event.preventDefault()
	event.returnValue = ''
}

onMounted(() => {
	window.addEventListener('beforeunload', warnOnUnload)
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
		return
	}
	if (isNew.value) return
	quizDetails.value.reload().then(() => refreshQuestionMeta())
})

// Removed by identity, or the warning follows the author onto every later page.
onUnmounted(() => {
	window.removeEventListener('beforeunload', warnOnUnload)
	// Or a tick armed on the way out persists the changes the author chose to discard.
	autosaveStopped = true
	autosaveGeneration += 1
})

// ignoreTyping: false so Cmd/Ctrl+S saves even while the cursor is in a field.
useKeyboardShortcuts({
	ignoreTyping: false,
	shortcuts: [saveShortcut(() => submitQuiz())],
})

// Created on the title's blur, not on a keystroke: the docname comes from the title.
const creating = ref(false)

const createIfNamed = async () => {
	if (!isNew.value || creating.value) return
	newQuiz.title = sanitizeOnWrite(newQuiz.title.trim())
	if (!newQuiz.title) return
	creating.value = true
	try {
		const created = await createResource({
			url: 'frappe.client.insert',
			auto: false,
		}).submit({ doc: { doctype: 'LMS Quiz', ...newQuiz } })
		capture('quiz_created')
		// The page is not remounted by this: the quizID watch above picks the quiz up.
		router.replace({ name: 'QuizForm', params: { quizID: created.name } })
	} catch (error) {
		creating.value = false
		toast.error(resourceErrorMessage(error, __('Error creating quiz')))
	}
}

// documentResource.js:15 returns undefined without BOTH a doctype and a name,
// and a quiz has no name until its title is left. The stand-in carries only the
// three fields read before then.
const standInQuiz = reactive({ doc: null, loading: false, isDirty: false })
const openQuiz = (quizID) =>
	quizID
		? createDocumentResource({ doctype: 'LMS Quiz', name: quizID, auto: false })
		: null
const quizResource = shallowRef(openQuiz(props.quizID))
const quizDetails = computed(() => quizResource.value ?? standInQuiz)

// /quizzes/new and /quizzes/:quizID resolve to the same component and
// <router-view> has no key, so vue patches this page instead of remounting.
// setup() does not rerun, so the resource follows the param.
watch(
	() => props.quizID,
	(quizID) => {
		if (!quizID || quizResource.value?.name === quizID) return
		quizResource.value = openQuiz(quizID)
		quizResource.value.reload().then(() => refreshQuestionMeta())
	}
)

const validateTitle = () => {
	quizDetails.value.doc.title = sanitizeOnWrite(
		quizDetails.value.doc.title.trim()
	)
}

// total_marks is stored but decided by the questions, so it is recomputed here.
watch(
	() => quizDetails.value.doc?.questions,
	() => {
		if (!quizDetails.value.doc) return
		quizDetails.value.doc.total_marks = calculateTotalMarks()
	},
	{ deep: true }
)

// Below quizDetails, because watch reads its source at once and doc is not declared yet.
watch(hasOpenEnded, (present) => {
	if (!present) forgetOpenEndedDismissal()
})

watch(
	() => quizDetails.value.doc?.enable_proctoring,
	(enabled) => {
		if (enabled && !quizDetails.value.doc.max_violations) {
			quizDetails.value.doc.max_violations = 3
		}
	}
)

// Resolves to whether the quiz reached the server, which is what lets autosave re-arm.
let saveInFlight = false

// One id for every save failure, so a quiz the server keeps rejecting says so once
// rather than stacking a toast per attempt. A save that lands clears it.
const SAVE_FAILED_TOAST = 'quiz-save-failed'

const submitQuiz = ({ notify = true } = {}) => {
	// Nothing to save once the quiz is deleted, and no side effect may re-insert it.
	if (!quizDetails.value.doc) return Promise.resolve(false)
	if (!canSave.value) return Promise.resolve(false)
	validateTitle()
	let saved = false
	saveInFlight = true
	return submitResource(
		quizDetails.value.setValue,
		{
			...quizDetails.value.doc,
			questions: savedQuestions(),
			total_marks: calculateTotalMarks(),
		},
		{
			onSuccess() {
				saved = true
				rejectedSnapshot = null
				toast.dismiss(SAVE_FAILED_TOAST)
				// Silent for an autosave. The failure below still speaks either way.
				if (notify) toast.success(__('Quiz updated successfully'))
			},
			onError(err) {
				// documentResource has already restored the doc by now, so this is the
				// content the retry guard measures a later edit against.
				rejectedSnapshot = JSON.stringify(quizDetails.value.doc)
				// The server message is the actionable half, so the warning wraps around it.
				// It stays up until dismissed, because nobody is watching an autosave fail.
				toast.error(
					__(
						'{0} Your changes are not saved. Do not close this tab until they are.'
					).format(err.messages?.[0] || err),
					{ id: SAVE_FAILED_TOAST, duration: Infinity }
				)
			},
		}
	)
		.then(() => saved)
		.finally(() => {
			saveInFlight = false
			// The doc is already replaced, so nothing is left to unmount these cards.
			flushPendingCardOpens()
		})
}

// One gate, canSave, because replacing the doc under an open card is the thing to avoid.
const AUTOSAVE_DELAY = 1200

// Neither debounce here has a cancel, so an armed tick carries the generation it was armed in.
let autosaveGeneration = 0
let autosaveStopped = false

// The doc as the server last rejected it. setValue.onError REPLACES the doc
// object (documentResource.js:58), tripping the same deep watcher an edit does,
// so the save re-fires every 1.2s.
let rejectedSnapshot = null

const autosave = useDebounceFn((generation) => {
	if (autosaveStopped) return
	if (generation !== autosaveGeneration) return
	// Two responses in flight would race to replace doc, and the loser would win.
	if (saveInFlight || !canSave.value) return
	submitQuiz({ notify: false }).then((saved) => {
		// Only after a save that landed, or a failure retries for as long as the page is open.
		if (saved) armAutosave()
	})
}, AUTOSAVE_DELAY)

const armAutosave = () => {
	autosaveGeneration += 1
	if (autosaveStopped || !canSave.value) return
	if (
		rejectedSnapshot !== null &&
		JSON.stringify(quizDetails.value.doc) === rejectedSnapshot
	)
		return
	autosave(autosaveGeneration)
}

// canSave is a source, not just a read, so opening a card disarms an armed tick.
watch([() => quizDetails.value.doc, canSave], () => armAutosave(), {
	deep: true,
})

// Mirrors LMS Quiz.calculate_total_marks. The limit only counts while shuffle
// is on (validate_limit zeroes it otherwise), and the server sums the first N
// rather than multiplying the first row's marks.
const calculateTotalMarks = () => {
	const rows = savedQuestions()
	const limit = quizDetails.value.doc?.shuffle_questions
		? Number(quizDetails.value.doc?.limit_questions_to) || 0
		: 0
	const counted = limit ? rows.slice(0, limit) : rows
	return counted.reduce((total, row) => total + (Number(row.marks) || 0), 0)
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

	if (isNew.value) {
		crumbs.push({ label: __('New Quiz') })
	} else if (doc.value?.title) {
		crumbs.push({
			label: doc.value.title,
			route: { name: 'QuizForm', params: { quizID: props.quizID } },
		})
	}
	return crumbs
})

usePageMeta(() => {
	return {
		title: doc.value?.title,
		icon: brand.favicon,
	}
})
</script>
