<template>
	<FormShell :title="title" size="3xl" @close="close">
		<template #default>
			<div v-if="!canManageQuestions" class="p-4 text-base text-ink-gray-6">
				{{ __('You are not permitted to edit this quiz.') }}
			</div>
			<div v-else data-testid="quiz-question-fields" class="space-y-5">
				<BooleanSwitch
					v-if="!editMode"
					size="sm"
					:label="__('Choose an existing question')"
					:description="__('Select from questions you have already created')"
					v-model="chooseFromExisting"
					class="!p-0"
				/>
				<div v-if="!chooseFromExisting || editMode">
					<div class="space-y-1.5">
						<InputLabel :id="questionLabelId" :label="__('Question')" />
						<RichTextEditor
							:content="question.question"
							@change="(val) => (question.question = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
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
					</div>
					<div
						v-if="question.type == 'Choices'"
						class="text-base-semibold text-ink-gray-9 mb-5 mt-10"
					>
						{{ __('Options') }}
					</div>
					<div
						v-else-if="question.type == 'User Input'"
						class="text-base-semibold text-ink-gray-9 mb-5 mt-5"
					>
						{{ __('Possibilities') }}
					</div>
					<div
						v-if="question.type == 'Choices'"
						class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4"
					>
						<div
							v-for="n in visibleOptionCount"
							:key="n"
							class="space-y-4 py-2"
						>
							<div class="flex items-center justify-between">
								<InputLabel
									:id="`question-option-${n}-label`"
									:label="__('Option') + ' ' + n"
								/>
								<Button
									v-if="visibleOptionCount > 2"
									variant="ghost"
									size="sm"
									:label="__('Remove option')"
									@click="removeOption(n)"
								>
									<template #icon>
										<span class="lucide-trash-2 size-4" />
									</template>
								</Button>
							</div>
							<FormControl
								v-model="question[`option_${n}`]"
								:required="n <= 2 ? true : false"
							/>
							<FormControl
								:label="__('Explanation')"
								v-model="question[`explanation_${n}`]"
							/>
							<BooleanSwitch
								size="sm"
								:label="__('Correct Answer')"
								:description="__('Mark this option as a correct answer.')"
								v-model="question[`is_correct_${n}`]"
							/>
						</div>
					</div>
					<div v-if="question.type == 'Choices'" class="mt-4">
						<Button
							v-if="visibleOptionCount < MAX_OPTIONS"
							@click="addOption()"
						>
							<template #prefix>
								<span class="lucide-plus size-4" />
							</template>
							{{ __('Add Option') }}
						</Button>
					</div>
					<div v-else-if="question.type == 'User Input'">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 py-2">
							<div
								v-for="n in visiblePossibilityCount"
								:key="n"
								class="flex items-end gap-2"
							>
								<FormControl
									class="flex-1"
									:label="__('Possibility') + ' ' + n"
									v-model="question[`possibility_${n}`]"
									:required="n == 1 ? true : false"
								/>
								<Button
									v-if="visiblePossibilityCount > 1"
									variant="ghost"
									:label="__('Remove possibility')"
									@click="removePossibility(n)"
								>
									<template #icon>
										<span class="lucide-trash-2 size-4" />
									</template>
								</Button>
							</div>
						</div>
						<div class="mt-4">
							<Button
								v-if="visiblePossibilityCount < MAX_OPTIONS"
								@click="addPossibility()"
							>
								<template #prefix>
									<span class="lucide-plus size-4" />
								</template>
								{{ __('Add Possibility') }}
							</Button>
						</div>
					</div>
				</div>
				<div v-else-if="chooseFromExisting" class="space-y-2">
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
		<template #actions>
			<div v-if="canManageQuestions" class="flex items-center justify-end">
				<HeaderButton
					data-testid="quiz-question-save"
					:label="__('Save')"
					variant="solid"
					:loading="saving"
					@click="submitQuestion()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup>
import {
	FormControl,
	createResource,
	createDocumentResource,
	Button,
	toast,
} from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { computed, watch, reactive, ref, inject, useId } from 'vue'
import Link from '@/components/Controls/Link.vue'
import { InputLabel } from '@/components/Form/labeling'
import { useOnboarding } from 'frappe-ui/frappe'
import RichTextEditor from '@/components/RichTextEditor.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import { submitResource } from '@/utils/resource'

const props = defineProps({
	quizID: {
		type: String,
		required: true,
	},
	// The LMS Quiz Question ROW name, not the LMS Question docname. `marks` lives
	// on the row, and the LMS Question docname is recoverable FROM the row via its
	// `question` link — the reverse is not true, because one LMS Question can be
	// reused by many rows. See design R2.
	questionName: {
		type: String,
		default: 'new',
	},
})

const questionLabelId = useId()
const chooseFromExisting = ref(false)
const user = inject('$user')
const { updateOnboardingStep } = useOnboarding('learning')

const { close, saveAndReplace } = useFormRoute({
	name: 'QuizForm',
	params: { quizID: props.quizID },
})

const editMode = computed(() => props.questionName !== 'new')

const title = computed(() =>
	editMode.value ? __('Edit Question') : __('Add Question')
)

// Copied from the openers on QuizForm.vue: the "New Question" button is gated on
// `!readOnlyMode` (:61) and the page bounces anyone who is neither a moderator
// nor an instructor (:313). A URL goes through neither. This is a UX gate, not
// the authorization boundary — Frappe's DocPerms on LMS Quiz / LMS Question are.
const canManageQuestions = computed(() => {
	if (window.read_only_mode) return false
	return Boolean(user.data?.is_moderator || user.data?.is_instructor)
})

const existingQuestion = reactive({
	question: '',
	marks: 1,
})

const question = reactive({
	question: '',
	type: 'Choices',
	marks: 1,
})

const MAX_OPTIONS = 10
const visibleOptionCount = ref(2)
const visiblePossibilityCount = ref(1)

const populateFields = () => {
	let fields = ['option', 'is_correct', 'explanation', 'possibility']
	fields.forEach((field) => {
		for (let counter = 1; counter <= MAX_OPTIONS; counter++) {
			question[`${field}_${counter}`] = field === 'is_correct' ? false : null
		}
	})
}

populateFields()

// QuizForm.vue has no list resource to share a cache key with: it renders
// `quizDetails.doc.questions`, the LMS Quiz child table (QuizForm.vue:308-310).
// So design C4's shared-instance trick lands on createDocumentResource instead —
// it caches on JSON.stringify([doctype, name]) and hands back the cached
// instance, discarding this call's options (documentResource.js:17-24). Passing
// the same doctype/name pair as QuizForm.vue:331-335 therefore returns the
// PARENT'S resource, so reloading it here is what makes a newly added question
// appear in the list behind the form. Changing either half of the pair breaks
// that silently. `auto: false` matches the parent, which owns the initial load.
const quizDetails = createDocumentResource({
	doctype: 'LMS Quiz',
	name: props.quizID,
	auto: false,
})

// C4 — edit mode used to be seeded from the parent's in-memory questions array,
// which is empty on a cold deep link. Fetch the row itself instead. Two chained
// fetches: the row carries `marks` and the LMS Question docname, and only once
// it lands can the question document be fetched — the watch below is what waits.
const questionRow = createDocumentResource({
	doctype: 'LMS Quiz Question',
	name: editMode.value ? props.questionName : undefined,
	auto: editMode.value,
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

const questionData = createResource({
	url: 'frappe.client.get',
	makeParams() {
		return {
			doctype: 'LMS Question',
			name: questionRow?.doc?.question,
		}
	},
	auto: false,
	onSuccess(data) {
		Object.keys(data).forEach((key) => {
			if (Object.hasOwn(question, key)) question[key] = data[key]
		})
		for (let counter = 1; counter <= MAX_OPTIONS; counter++) {
			question[`is_correct_${counter}`] = data[`is_correct_${counter}`]
				? true
				: false
		}
		visibleOptionCount.value = Math.max(
			2,
			...Array.from({ length: MAX_OPTIONS }, (_, i) =>
				data[`option_${i + 1}`] ? i + 1 : 0
			)
		)
		visiblePossibilityCount.value = Math.max(
			1,
			...Array.from({ length: MAX_OPTIONS }, (_, i) =>
				data[`possibility_${i + 1}`] ? i + 1 : 0
			)
		)
		// marks belongs to the ROW, not to the shared LMS Question, so read it back
		// off the row after the loop above has run.
		question.marks = questionRow.doc?.marks
	},
})

// C3 — the load used to hang off a watch on the visibility model with no
// `immediate: true`, so a directly-mounted route rendered blank. `immediate`
// also covers createDocumentResource handing back an already-populated cached
// instance, whose `doc` would never change afterwards.
watch(
	() => questionRow?.doc,
	(doc) => {
		if (!doc) return
		question.marks = doc.marks
		if (doc.question) questionData.fetch()
	},
	{ immediate: true }
)

const quizQuestionInsert = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Quiz Question',
				parent: props.quizID,
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
			// The route param IS the row name — see the prop comment above.
			name: props.questionName,
			fieldname: {
				marks: question.marks,
			},
		}
	},
})

const saving = computed(
	() =>
		quizQuestionInsert.loading ||
		questionCreation.loading ||
		questionUpdate.loading ||
		marksUpdate.loading
)

const addPossibility = () => {
	if (visiblePossibilityCount.value < MAX_OPTIONS)
		visiblePossibilityCount.value++
}

const removePossibility = (pos) => {
	if (visiblePossibilityCount.value <= 1) return
	for (let n = pos; n < visiblePossibilityCount.value; n++) {
		question[`possibility_${n}`] = question[`possibility_${n + 1}`]
	}
	question[`possibility_${visiblePossibilityCount.value}`] = null
	visiblePossibilityCount.value--
}

const addOption = () => {
	if (visibleOptionCount.value < MAX_OPTIONS) visibleOptionCount.value++
}

const removeOption = (pos) => {
	if (visibleOptionCount.value <= 2) return
	for (let n = pos; n < visibleOptionCount.value; n++) {
		question[`option_${n}`] = question[`option_${n + 1}`]
		question[`is_correct_${n}`] = question[`is_correct_${n + 1}`]
		question[`explanation_${n}`] = question[`explanation_${n + 1}`]
	}
	const last = visibleOptionCount.value
	question[`option_${last}`] = null
	question[`is_correct_${last}`] = false
	question[`explanation_${last}`] = null
	visibleOptionCount.value--
}

const submitQuestion = () => {
	if (!canManageQuestions.value) return
	if (editMode.value) updateQuestion()
	else addQuestion()
}

const addQuestion = () => {
	if (chooseFromExisting.value) {
		addQuestionRow({
			question: existingQuestion.question,
			marks: existingQuestion.marks,
		})
	} else {
		submitResource(
			questionCreation,
			{},
			{
				onSuccess(data) {
					addQuestionRow({
						question: data.name,
						marks: question.marks,
					})
				},
				onError(err) {
					toast.error(err.messages?.[0] || err)
				},
			}
		)
	}
}

// The modal closed itself on error as well as on success. As a route that would
// navigate away and discard a half-filled form, so the error path now stays put
// and only surfaces the toast.
const addQuestionRow = (values) => {
	submitResource(
		quizQuestionInsert,
		{
			...values,
		},
		{
			onSuccess() {
				if (user.data?.is_system_manager)
					updateOnboardingStep('create_first_quiz')

				toast.success(__('Question added successfully'))
				quizDetails.reload()
				saveAndReplace({
					name: 'QuizForm',
					params: { quizID: props.quizID },
				})
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const updateQuestion = () => {
	submitResource(
		questionUpdate,
		{},
		{
			onSuccess() {
				submitResource(
					marksUpdate,
					{},
					{
						onSuccess() {
							toast.success(__('Question updated successfully'))
							quizDetails.reload()
							saveAndReplace({
								name: 'QuizForm',
								params: { quizID: props.quizID },
							})
						},
					}
				)
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>
<style>
input[type='radio']:checked {
	background-color: theme('colors.gray.900') !important;
	border-color: theme('colors.gray.900') !important;
	--tw-ring-color: theme('colors.gray.900') !important;
}
</style>
