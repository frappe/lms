<template>
	<FormShell :title="title" size="4xl" @close="close">
		<template #header-action>
			<Badge v-if="isDirty && canManageExercise" theme="orange">
				{{ __('Not Saved') }}
			</Badge>
		</template>
		<template #default>
			<div v-if="!canManageExercise" class="p-4 text-base text-ink-gray-6">
				{{ __('You are not permitted to manage programming exercises.') }}
			</div>
			<div
				v-else
				data-testid="programming-exercise-fields"
				class="grid grid-cols-1 sm:grid-cols-2 gap-10"
			>
				<div class="space-y-4">
					<FormControl
						v-model="exercise.title"
						:label="__('Title')"
						:required="true"
					/>
					<FormControl
						v-model="exercise.language"
						:label="__('Language')"
						type="select"
						:options="languageOptions"
						:required="true"
					/>
					<ChildTable
						v-model="testCases.data"
						:label="__('Test Cases')"
						:columns="testCaseColumns"
						:required="true"
						:addable="true"
						:deletable="true"
						:editable="true"
						:placeholder="__('Add Test Case')"
					/>
				</div>
				<div>
					<div class="space-y-1.5">
						<InputLabel
							:id="problemStatementLabelId"
							:label="__('Problem Statement')"
							:required="true"
						/>
						<RichTextEditor
							:content="exercise.problem_statement"
							@change="(val: string) => (exercise.problem_statement = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[10rem] max-h-[21rem] overflow-y-auto"
						/>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div
				v-if="canManageExercise"
				class="flex items-center justify-end gap-2 group"
			>
				<HeaderButton
					v-if="exerciseID != 'new'"
					data-testid="programming-exercise-delete"
					:label="__('Delete exercise')"
					icon="lucide-trash-2"
					variant="outline"
					theme="red"
					@click="deleteExercise()"
				/>
				<router-link
					v-if="exerciseID != 'new'"
					:to="{
						name: 'ProgrammingExerciseSubmission',
						params: {
							exerciseID: props.exerciseID,
							submissionID: 'new',
						},
					}"
				>
					<HeaderButton
						:label="__('Test this Exercise')"
						icon="lucide-play"
						class="text-p-base-medium"
					/>
				</router-link>
				<router-link
					v-if="exerciseID != 'new'"
					:to="{
						name: 'ProgrammingExerciseSubmissions',
						query: {
							exercise: props.exerciseID,
						},
					}"
				>
					<HeaderButton
						:label="__('Check Submission')"
						icon="lucide-clipboard-list"
					/>
				</router-link>
				<HeaderButton
					data-testid="programming-exercise-save"
					:label="__('Save')"
					variant="solid"
					@click="saveExercise()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import { computed, inject, ref, watch, useId } from 'vue'
import { InputLabel } from '@/components/Form/labeling'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import {
	Badge,
	createDocumentResource,
	createListResource,
	createResource,
	FormControl,
	toast,
} from 'frappe-ui'
import { ProgrammingExercise, TestCase } from '@/types'
import ChildTable from '@/components/Controls/ChildTable.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import { submitResource } from '@/utils/resource'

const user = inject<any>('$user')
const problemStatementLabelId = useId()
const isDirty = ref(false)
const originalTestCaseCount = ref(0)

const props = withDefaults(
	defineProps<{
		exerciseID: string
	}>(),
	{
		exerciseID: 'new',
	}
)

const { close, saveAndReplace } = useFormRoute({ name: 'ProgrammingExercises' })

// Its own list resource, but every option here is deliberately byte-identical
// to ProgrammingExercises.vue:131-138. createListResource returns whichever
// instance was cached first under this key and DISCARDS the later caller's
// options (listResource.js:15-22), so:
//   - the list page constructs first in the app (a parent route component's
//     setup runs before its child's), which is why the options are duplicated
//     rather than trimmed — on the one path where this call wins the race the
//     list must still get the fields/orderBy/pageLength it relies on (C4b);
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
// The key matches ProgrammingExercises.vue:238. Its `params` carry no filters
// because the filters live in the list page's refs; the list page always
// constructs this first in the app, so its params are the ones that survive.
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
	// Cast because Window has no read_only_mode declaration; same shape as
	// NewBatchForm.vue:190.
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return false
	return Boolean(
		user.data?.is_moderator ||
			user.data?.is_instructor ||
			user.data?.is_evaluator
	)
})

const title = computed(() =>
	props.exerciseID === 'new'
		? __('Create Programming Exercise')
		: __('Edit Programming Exercise')
)

// Only the fields this form edits. Deliberately NOT the whole fetched doc:
// updateExercise spreads this straight into frappe.client.set_value's fieldname
// map, so carrying `owner`/`creation`/`modified` along would write meta fields
// back on every save.
type ExerciseForm = {
	name?: string
	title: string
	language: 'Python' | 'JavaScript'
	problem_statement: string
	test_cases: { input: string; expected_output: string; idx: number }[]
}

const emptyExercise = (): ExerciseForm => ({
	title: '',
	language: 'Python',
	problem_statement: '',
	test_cases: [],
})

const exercise = ref<ExerciseForm>(emptyExercise())

const languageOptions = [
	{ label: 'Python', value: 'Python' },
	{ label: 'JavaScript', value: 'JavaScript' },
]

// C4 — edit mode used to be seeded from the list page's in-memory rows, which
// are empty when this route is opened cold. Fetch the record instead, following
// JobForm.vue:182-190.
//
// Constructed conditionally rather than with `name: undefined`, as
// CouponDetails.vue:116-121 does: createDocumentResource bails out and returns
// UNDEFINED for a falsy name (documentResource.js:15), so create mode has no
// resource at all — hence the optional chaining below rather than a plain read.
const exerciseDoc =
	props.exerciseID != 'new'
		? createDocumentResource({
				doctype: 'LMS Programming Exercise',
				name: props.exerciseID,
				auto: true,
				onError(err: any) {
					toast.error(__(err.messages?.[0] || err))
					console.error('Error loading exercise:', err)
				},
		  })
		: undefined

watch(
	() => exerciseDoc?.doc,
	(doc: ProgrammingExercise | undefined) => {
		if (!doc) return
		exercise.value = {
			name: doc.name,
			title: doc.title,
			language: doc.language,
			problem_statement: doc.problem_statement,
			test_cases: [],
		}
		isDirty.value = false
	},
	{ immediate: true }
)

const testCases = createListResource({
	doctype: 'LMS Test Case',
	fields: ['input', 'expected_output', 'name'],
	parent: 'LMS Programming Exercise',
	orderBy: 'idx',
	onSuccess(data: TestCase[]) {
		isDirty.value = false
		originalTestCaseCount.value = data.length
	},
	onError(err: any) {
		toast.error(__(err.messages?.[0] || err))
		console.error('Error loading testCases:', err)
	},
})

const fetchTestCases = () => {
	testCases.update({
		filters: {
			parent: props.exerciseID,
			parenttype: 'LMS Programming Exercise',
			parentfield: 'test_cases',
		},
	})
	testCases.reload()
}

// C3 — this watch had no `immediate`, so the test cases were fetched only when
// the id CHANGED under an already-mounted parent. Mounted straight from a URL
// the exercise rendered with an empty Test Cases table, and saving it would
// have written that emptiness back.
watch(
	() => props.exerciseID,
	(id) => {
		if (id === 'new') {
			exercise.value = emptyExercise()
			testCases.data = []
			originalTestCaseCount.value = 0
			isDirty.value = false
			return
		}
		fetchTestCases()
	},
	{ immediate: true }
)

const validateTitle = () => {
	exercise.value.title = sanitizeOnWrite(exercise.value.title.trim())
}

watch(
	exercise,
	() => {
		isDirty.value = true
	},
	{ deep: true }
)

watch(testCases, () => {
	if (testCases.data?.length !== originalTestCaseCount.value) {
		isDirty.value = true
	}
})

const updateTestCasesInExercise = () => {
	exercise.value.test_cases = (testCases.data || []).map(
		(tc: TestCase, index: number) => ({
			input: tc.input,
			expected_output: tc.expected_output,
			idx: index + 1,
		})
	)
}

const saveExercise = () => {
	if (!canManageExercise.value) return
	validateTitle()
	updateTestCasesInExercise()
	if (props.exerciseID == 'new') createNewExercise()
	else updateExercise()
}

const createNewExercise = () => {
	submitResource(
		exercises.insert,
		{
			...exercise.value,
		},
		{
			onSuccess() {
				isDirty.value = false
				// insert already refetched the list itself (listResource.js:123);
				// only the header count needs telling.
				exerciseCount.reload()
				toast.success(__('Programming Exercise created successfully'))
				// replace, not push: the form entry is consumed so Back reaches
				// whatever preceded the list rather than a stale empty form.
				saveAndReplace({ name: 'ProgrammingExercises' })
			},
			onError(err: any) {
				toast.warning(__(err.messages?.[0] || err))
			},
		}
	)
}

const updateExercise = () => {
	submitResource(
		exercises.setValue,
		{
			name: props.exerciseID,
			...exercise.value,
		},
		{
			onSuccess() {
				isDirty.value = false
				// setValue patches the row in place, which cannot reorder a list
				// sorted by `modified desc` — so this one does need a refetch.
				exercises.reload()
				toast.success(__('Programming Exercise updated successfully'))
				saveAndReplace({ name: 'ProgrammingExercises' })
			},
			onError(err: any) {
				toast.warning(__(err.messages?.[0] || err))
			},
		}
	)
}

const testCaseColumns = computed(() => {
	return ['Input', 'Expected Output']
})

const deleteExercise = () => {
	if (props.exerciseID == 'new') return
	if (!canManageExercise.value) return
	submitResource(exercises.delete, props.exerciseID, {
		onSuccess() {
			// delete refetches the list (listResource.js:161); the count was
			// left stale by the modal this form replaces.
			exerciseCount.reload()
			toast.success(__('Programming Exercise deleted successfully'))
			close()
		},
		onError(err: any) {
			toast.warning(__(err.messages?.[0] || err))
		},
	})
}
</script>
