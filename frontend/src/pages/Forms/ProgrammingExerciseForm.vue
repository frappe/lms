<template>
	<PageHeader :breadcrumbs="breadcrumbs">
		<template #actions>
			<template v-if="canManageExercise">
				<Badge v-if="!isNew" :theme="saved ? 'green' : 'amber'">
					{{ saved ? __('Saved') : __('Not saved') }}
				</Badge>
				<template v-if="!isNew">
					<HeaderButton
						data-testid="programming-exercise-preview"
						variant="subtle"
						icon="lucide-eye"
						:label="previewing ? __('Back to editing') : __('Preview')"
						:aria-pressed="previewing"
						:disabled="!previewing && !saved"
						@click="togglePreview()"
					/>
					<HeaderButton
						data-testid="programming-exercise-submissions"
						variant="subtle"
						icon="lucide-clipboard-list"
						:label="__('Submissions')"
						@click="goToSubmissions()"
					/>
					<HeaderButton
						data-testid="programming-exercise-delete"
						variant="subtle"
						theme="red"
						icon="lucide-trash-2"
						:label="__('Delete')"
						@click="deleteExercise()"
					/>
				</template>
			</template>
		</template>
	</PageHeader>
	<div v-if="!canManageExercise" class="p-5 text-base text-ink-gray-6">
		{{ __('You are not permitted to manage programming exercises.') }}
	</div>
	<div
		v-else
		data-testid="programming-exercise-fields"
		class="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[7fr,3fr]"
	>
		<div
			class="flex min-h-0 flex-col gap-8 overflow-y-auto p-5"
			@focusout="createIfReady()"
		>
			<div
				v-if="previewing"
				data-testid="programming-exercise-preview-pane"
				class="h-[900px] w-full"
			>
				<ProgrammingExerciseSubmission
					:exerciseID="props.exerciseID"
					submissionID="new"
					preview
				/>
			</div>
			<template v-else>
				<div class="flex flex-col gap-1.5">
					<InputLabel
						:id="problemStatementLabelId"
						:label="__('Problem Statement')"
						:required="true"
					/>
					<div data-testid="programming-exercise-problem-statement">
						<RichTextEditor
							:ariaLabelledby="problemStatementLabelId"
							:ariaRequired="true"
							:content="exercise.problem_statement"
							@change="onProblemStatementChange"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-gray-2 hover:border-outline-gray-3 hover:shadow-sm focus-within:border-outline-gray-4 focus-within:shadow-sm rounded-b-5 py-1 px-2 min-h-[12rem] transition-colors"
						/>
					</div>
				</div>
				<div class="flex flex-col gap-1.5">
					<InputLabel :id="starterCodeLabelId" :label="__('Starter Code')" />
					<div
						class="overflow-hidden rounded-5 border border-outline-gray-2"
						data-testid="programming-exercise-starter-code"
					>
						<ExerciseCodeEditor
							v-model="exercise.starter_code"
							:language="exercise.language"
							:label="__('Starter Code')"
							contentClass="min-h-[24rem]"
						/>
					</div>
					<InputDescription
						:id="starterCodeDescriptionId"
						:description="
							__(
								'Prefills the learner’s editor. Leave empty for the language default.'
							)
						"
					/>
				</div>
				<div data-testid="programming-exercise-test-cases">
					<ChildTable
						v-model="testCaseRows"
						:label="__('Test Cases')"
						:columns="testCaseColumns"
						:checkbox-keys="['hidden']"
						:required="true"
					/>
				</div>
			</template>
		</div>
		<div
			class="order-first min-w-0 space-y-4 border-b p-5 lg:order-none lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-s"
		>
			<FormControl
				v-model="exercise.title"
				data-testid="programming-exercise-title"
				variant="outline"
				:label="__('Title')"
				:required="true"
				@blur="onTitleBlur()"
			/>
			<FormControl
				v-model="exercise.language"
				:label="__('Language')"
				variant="outline"
				type="select"
				:options="languageOptions"
				:required="true"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, ref, shallowRef, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { InputDescription, InputLabel } from 'frappe-ui/experimental'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import {
	Badge,
	createDocumentResource,
	createListResource,
	createResource,
	FormControl,
	toast,
} from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { ProgrammingExercise, TestCase } from '@/types'
import ChildTable from '@/components/Controls/ChildTable.vue'
import ExerciseCodeEditor from '@/components/ProgrammingExercises/ExerciseCodeEditor.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import ProgrammingExerciseSubmission from '@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { useAutosaveDoc } from '@/composables/useAutosaveDoc'
import {
	saveShortcut,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

const user = inject<any>('$user')
const router = useRouter()
const problemStatementLabelId = useId()
const starterCodeLabelId = useId()
const starterCodeDescriptionId = useId()
const previewing = ref(false)
const committedTitle = ref('')
const creating = ref(false)

const props = withDefaults(
	defineProps<{
		exerciseID: string
	}>(),
	{
		exerciseID: 'new',
	}
)

const isNew = computed(() => props.exerciseID === 'new')

// Its own list resource, but every option here is deliberately byte-identical
// to ProgrammingExercises.vue:131-138. createListResource returns whichever
// instance was cached first under this key and DISCARDS the later caller's
// options (listResource.js:15-22), so:
//   - a created or deleted exercise reaches the list only because insert and
//     delete refetch THAT instance (listResource.js:123, :161). Disambiguating
//     either key — a filter, a tab, a start — breaks that silently.
// setValue needs none of this: it patches every registered list resource for
// the doctype by name (:144).
const exercises = createListResource({
	doctype: 'LMS Programming Exercise',
	cache: ['programmingExercises'],
	fields: ['name', 'title', 'language', 'problem_statement', 'modified'],
	auto: true,
	orderBy: 'modified desc',
	pageLength: 24,
})

// Same shared-instance trick for the header count, which nothing else
// refreshes: createResource caches by key identically (resources.js:10-20).
// The key matches ProgrammingExercises.vue:238.
const exerciseCount = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Programming Exercise',
	},
	cache: ['programming_exercises_count', user.data?.name],
})

// Copied from the gate ProgrammingExercises.vue puts on the Create button
// (:33) and on row click (:152), plus the page-level role check at :119-129.
// A URL goes through neither. This is a UX gate, NOT the authorization
// boundary — Frappe's server-side DocPerms on LMS Programming Exercise are.
const canManageExercise = computed(() => {
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return false
	return Boolean(
		user.data?.is_moderator ||
			user.data?.is_instructor ||
			user.data?.is_evaluator
	)
})

// Only the fields this form edits. Deliberately NOT the whole fetched doc: the
// payload is spread straight into set_value's fieldname map, so carrying
// `owner`/`creation`/`modified` along would write meta fields back every save.
type ExerciseForm = {
	title: string
	language: 'Python' | 'JavaScript'
	problem_statement: string
	starter_code: string
}

const emptyExercise = (): ExerciseForm => ({
	title: '',
	language: 'Python',
	problem_statement: '',
	starter_code: '',
})

const exercise = ref<ExerciseForm>(emptyExercise())
const testCaseRows = ref<
	{ input: string; expected_output: string; hidden: boolean }[]
>([])

const languageOptions = [
	{ label: 'Python', value: 'Python' },
	{ label: 'JavaScript', value: 'JavaScript' },
]

const testCaseColumns = computed(() => ['Input', 'Expected Output', 'Hidden'])

const completeRows = () =>
	testCaseRows.value.filter((row) => row.expected_output)

// Rows without an expected output (required on the server) wait on the page.
// idx is renumbered by position, or a drag's new order would be lost.
const formPayload = () => ({
	title: exercise.value.title,
	language: exercise.value.language,
	problem_statement: exercise.value.problem_statement,
	starter_code: exercise.value.starter_code,
	test_cases: completeRows().map((row, index) => ({
		input: row.input,
		expected_output: row.expected_output,
		hidden: row.hidden ? 1 : 0,
		idx: index + 1,
	})),
})

// Built from the prop, not at setup: /new and /edit/:exerciseID share the
// component, so the create flow patches this page rather than remounting it.
const exerciseDoc = shallowRef<any>(undefined)

watch(
	() => props.exerciseID,
	(id) => {
		previewing.value = false
		creating.value = false
		committedTitle.value = ''
		if (id === 'new') {
			exerciseDoc.value = undefined
			exercise.value = emptyExercise()
			testCaseRows.value = []
			return
		}
		exerciseDoc.value = createDocumentResource({
			doctype: 'LMS Programming Exercise',
			name: id,
			auto: true,
			onError(err: FrappeResourceError) {
				toast.error(resourceErrorMessage(err, __('Error')))
			},
		})
	},
	{ immediate: true }
)

// Seeding must not read as an edit. Compared by value, not a flag: the seed
// lands before the edit watcher exists, so a flag would eat the first edit.
let lastSeeded = ''
// What the create sent. Edits made while it was in flight stay on the page and
// are autosaved, instead of being replaced by the server's copy.
let sentOnCreate = ''

watch(
	() => exerciseDoc.value?.doc,
	(doc: ProgrammingExercise | undefined) => {
		if (!doc) return
		if (sentOnCreate) {
			lastSeeded = sentOnCreate
			sentOnCreate = ''
			if (JSON.stringify(formPayload()) !== lastSeeded) autosave.schedule()
			return
		}
		exercise.value = {
			title: doc.title,
			language: doc.language,
			problem_statement: doc.problem_statement,
			starter_code: doc.starter_code ?? '',
		}
		testCaseRows.value = (doc.test_cases || []).map((row: TestCase) => ({
			input: row.input,
			expected_output: row.expected_output,
			// A row loaded from the server carries `hidden` as 1/0, not a
			// boolean — `??` alone binds a number to the checkbox v-model.
			hidden: Boolean(row.hidden ?? 1),
		}))
		lastSeeded = JSON.stringify(formPayload())
	},
	{ immediate: true }
)

const autosave = useAutosaveDoc({
	payload: () => (isNew.value ? null : formPayload()),
	// frappe-ui's submit() never rejects, so the error is read off the resource.
	async save(body) {
		await exercises.setValue.submit({ name: props.exerciseID, ...body })
		const error = exercises.setValue.error
		if (!error) return
		toast.error(resourceErrorMessage(error, __('Error')))
		throw error
	},
})

const saved = autosave.saved

watch(
	[exercise, testCaseRows],
	() => {
		if (isNew.value) return
		const current = JSON.stringify(formPayload())
		if (current === lastSeeded) return
		lastSeeded = ''
		autosave.schedule()
	},
	{ deep: true }
)

useKeyboardShortcuts({ shortcuts: [saveShortcut(() => autosave.flush())] })

const onProblemStatementChange = (value: string) => {
	exercise.value.problem_statement = value
}

// Created on a blur once the server's required fields are in (a statement with
// text or an image, one test case), and only under the title last left, so a
// half-typed title never names the document.
const hasContent = (html: string): boolean =>
	html.includes('<img') ||
	Boolean(
		new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim()
	)

const readyToCreate = (): boolean =>
	Boolean(committedTitle.value) &&
	exercise.value.title === committedTitle.value &&
	hasContent(exercise.value.problem_statement) &&
	completeRows().length > 0

const onTitleBlur = () => {
	exercise.value.title = sanitizeOnWrite(exercise.value.title.trim())
	committedTitle.value = exercise.value.title
	createIfReady()
}

const createIfReady = () => {
	if (!isNew.value || creating.value || !canManageExercise.value) return
	if (!readyToCreate()) return
	creating.value = true
	const payload = formPayload()
	sentOnCreate = JSON.stringify(payload)
	submitResource(exercises.insert, payload, {
		onSuccess(doc: { name: string }) {
			// insert already refetched the list itself (listResource.js:123).
			exerciseCount.reload()
			// Only if still here: the blur that created it may have been a click away.
			// replace, not push: Back reaches the list, not an already-written form.
			if (router.currentRoute.value.name !== 'NewProgrammingExercise') return
			router.replace({
				name: 'ProgrammingExerciseForm',
				params: { exerciseID: doc.name },
			})
		},
		onError(err: FrappeResourceError) {
			creating.value = false
			sentOnCreate = ''
			toast.warning(resourceErrorMessage(err, __('Error')))
		},
	})
}

const breadcrumbs = computed(() => [
	{
		label: __('Programming Exercises'),
		route: { name: 'ProgrammingExercises' },
	},
	{
		label: exercise.value.title || __('New Programming Exercise'),
		route: isNew.value
			? { name: 'NewProgrammingExercise' }
			: {
					name: 'ProgrammingExerciseForm',
					params: { exerciseID: props.exerciseID },
			  },
	},
])

const goToSubmissions = () => {
	router.push({
		name: 'ProgrammingExerciseSubmissions',
		query: { exercise: props.exerciseID },
	})
}

// The preview renders the saved record, so anything the form is still holding
// goes out first or the author is shown a version behind.
const togglePreview = async () => {
	if (previewing.value) {
		previewing.value = false
		return
	}
	await autosave.flush()
	if (!saved.value) return
	previewing.value = true
}

const deleteExercise = () => {
	if (isNew.value || !canManageExercise.value) return
	submitResource(exercises.delete, props.exerciseID, {
		onSuccess() {
			// delete refetches the list (listResource.js:161); the count was
			// left stale by the dialog this page replaces.
			exerciseCount.reload()
			toast.success(__('Programming Exercise deleted successfully'))
			router.replace({ name: 'ProgrammingExercises' })
		},
		onError(err: FrappeResourceError) {
			toast.warning(resourceErrorMessage(err, __('Error')))
		},
	})
}
</script>
