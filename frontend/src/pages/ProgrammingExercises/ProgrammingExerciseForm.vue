<template>
	<Dialog v-model="show" :options="{ size: '5xl' }">
		<template #body-title>
			<div class="text-xl font-semibold text-ink-gray-9">
				{{
					props.exerciseID === 'new'
						? __('Create Programming Exercise')
						: __('Edit Programming Exercise')
				}}
			</div>
		</template>
		<template #body-content>
			<div class="grid grid-cols-2 gap-10">
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
						v-model="exercise.test_cases"
						:columns="testCaseColumns"
						:required="true"
						:addable="true"
						:deletable="true"
						:editable="true"
						:placeholder="__('Add Test Case')"
					/>
				</div>
				<div>
					<div>
						<div class="text-xs text-ink-gray-5 mb-2">
							{{ __('Problem Statement') }}
							<span class="text-ink-red-3">*</span>
						</div>
						<TextEditor
							:content="exercise.problem_statement"
							@change="(val: string) => (exercise.problem_statement = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[21rem] overflow-y-auto"
						/>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="flex justify-end space-x-2">
				<router-link
					:to="{
						name: 'ProgrammingExerciseSubmission',
						params: {
							exerciseID: props.exerciseID,
							submissionID: 'new',
						},
					}"
				>
					<Button>
						{{ __('Test this Exercise') }}
					</Button>
				</router-link>
				<router-link
					:to="{
						name: 'ProgrammingExerciseSubmissions',
						query: {
							exercise: props.exerciseID,
						},
					}"
				>
					<Button>
						{{ __('Check Submission') }}
					</Button>
				</router-link>
				<Button variant="solid" @click="saveExercise(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Button,
	createListResource,
	Dialog,
	FormControl,
	TextEditor,
	toast,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { ProgrammingExercise, TestCase } from '@/types/programming-exercise'
import ChildTable from '@/components/Controls/ChildTable.vue'

const show = defineModel()
const exercises = defineModel<{
	data: ProgrammingExercise[]
	reload: () => void
	hasNextPage: boolean
	next: () => void
	setValue: {
		submit: (
			data: ProgrammingExercise,
			options?: { onSuccess?: () => void }
		) => void
	}
}>('exercises')

const exercise = ref<ProgrammingExercise>({
	title: '',
	language: 'Python',
	problem_statement: '',
	test_cases: [],
})

const languageOptions = [
	{ label: 'Python', value: 'Python' },
	{ label: 'JavaScript', value: 'JavaScript' },
	{ label: 'Java', value: 'Java' },
	{ label: 'C++', value: 'C++' },
]

const props = withDefaults(
	defineProps<{
		exerciseID: string
	}>(),
	{
		exerciseID: 'new',
	}
)

watch(
	() => props.exerciseID,
	() => {
		if (props.exerciseID != 'new') {
			setExerciseData()
			fetchTestCases()
		}
	}
)

const setExerciseData = () => {
	exercises.value?.data.forEach((ex) => {
		if (ex.name === props.exerciseID) {
			exercise.value = { ...ex }
		}
	})
}

const testCases = createListResource({
	doctype: 'LMS Test Case',
	fields: ['input', 'expected_output', 'name'],
	cache: ['testCases', props.exerciseID],
	parent: 'LMS Programming Exercise',
	onSuccess(data: TestCase[]) {
		exercise.value.test_cases = data
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

const saveExercise = (close: () => void) => {
	if (props.exerciseID == 'new') createNewExercise(close)
	else updateExercise(close)
}

const createNewExercise = (close: () => void) => {
	exercises.value.insert.submit(
		{
			...exercise.value,
		},
		{
			onSuccess() {
				close()
				exercises.value.reload()
				toast.success(__('Programming Exercise created successfully'))
			},
		}
	)
}

const updateExercise = (close: () => void) => {
	exercises.value.setValue.submit(
		{
			name: props.exerciseID,
			...exercise.value,
		},
		{
			onSuccess() {
				close()
				exercises.value.reload()
				toast.success(__('Programming Exercise updated successfully'))
			},
		}
	)
}

const testCaseColumns = computed(() => {
	return ['Input', 'Expected Output']
})
</script>
