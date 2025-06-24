<template>
	<header
		v-if="!fromLesson"
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div class="grid grid-cols-2 h-[calc(100vh_-_3rem)]">
		<div
			v-html="exercise.doc?.problem_statement"
			class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal border-r px-5 py-2 h-full"
		></div>
		<div>
			<div class="flex items-center justify-between p-2 bg-surface-gray-2">
				<div class="font-semibold">
					{{ exercise.doc?.language }}
				</div>
				<div class="space-x-2">
					<Badge
						v-if="submission.doc?.status"
						:theme="submission.doc.status == 'Passed' ? 'green' : 'red'"
					>
						{{ submission.doc.status }}
					</Badge>
					<Button variant="solid" @click="submitCode">
						<template #prefix>
							<Play class="size-3" />
						</template>
						{{ __('Run') }}
					</Button>
				</div>
			</div>
			<div class="flex flex-col space-y-4 py-5 border-b">
				<Code
					v-model="code"
					language="python"
					height="400px"
					maxHeight="1000px"
				/>
				<span v-if="error" class="text-xs text-ink-gray-5 px-2">
					{{ __('Compiler Message') }}:
				</span>
				<textarea
					v-if="error"
					v-model="errorMessage"
					class="bg-surface-gray-1 border-none text-sm h-28 leading-6"
					readonly
				/>
				<!-- <textarea v-else v-model="output" class="bg-surface-gray-1 border-none text-sm h-28 leading-6" readonly /> -->
			</div>

			<div ref="testCaseSection" v-if="testCases.length" class="p-3">
				<span class="text-lg font-semibold text-ink-gray-9">
					{{ __('Test Cases') }}
				</span>
				<div class="divide-y mt-5">
					<div
						v-for="(testCase, index) in testCases"
						:key="testCase.input"
						class="py-3"
					>
						<div class="flex items-center mb-5">
							<span class=""> {{ __('Test {0}').format(index + 1) }} - </span>
							<span
								class="font-semibold ml-2 mr-1"
								:class="
									testCase.status === 'Passed'
										? 'text-ink-green-3'
										: 'text-ink-red-3'
								"
							>
								{{ testCase.status }}
							</span>
							<span v-if="testCase.status === 'Passed'">
								<Check class="size-4 text-ink-green-3" />
							</span>
							<span v-else>
								<X class="size-4 text-ink-red-3" />
							</span>
						</div>
						<div class="flex items-center justify-between w-[60%]">
							<div v-if="testCase.input" class="space-y-2">
								<div class="text-xs text-ink-gray-7">{{ __('Input') }}:</div>
								<div>{{ testCase.input }}</div>
							</div>
							<div class="space-y-2">
								<div class="text-xs text-ink-gray-7">
									{{ __('Your Output') }}
								</div>
								<div>
									{{ testCase.output }}
								</div>
							</div>
							<div class="space-y-2">
								<div class="text-xs text-ink-gray-7">
									{{ __('Expected Output') }}
								</div>
								<div>{{ testCase.expected_output }}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	Badge,
	Breadcrumbs,
	Button,
	call,
	createDocumentResource,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { Play, X, Check } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'

const code = ref<string | null>('')
const output = ref<string | null>(null)
const error = ref<boolean | null>(null)
const errorMessage = ref<string | null>(null)
const testCaseSection = ref<HTMLElement | null>(null)
const testCases = ref<
	Array<{
		input: string
		output: string
		expected_output: string
		status: string
	}>
>([])
const boilerplate = ref<string>(
	`with open("stdin", "r") as f:\n    data = f.read()\n\ninputs = data.split() if len(data) else []\n\n# inputs is a list of strings\n# write your code below\n\n`
)
const { brand } = sessionStore()
const router = useRouter()
const fromLesson = ref(false)

const props = withDefaults(
	defineProps<{
		exerciseID: string
		submissionID?: string
	}>(),
	{
		submissionID: 'new',
	}
)

onMounted(() => {
	loadFalcon()
	if (props.submissionID != 'new') {
		submission.reload()
	}
	if (!code.value) {
		code.value = boilerplate.value
	}
	if (new URLSearchParams(window.location.search).get('fromLesson')) {
		fromLesson.value = true
	}
})

const exercise = createDocumentResource({
	doctype: 'LMS Programming Exercise',
	name: props.exerciseID,
	cache: ['programmingExercise', props.exerciseID],
	auto: true,
})

const submission = createDocumentResource({
	doctype: 'LMS Programming Exercise Submission',
	name: props.submissionID,
	cache: ['programmingExerciseSubmission', props.submissionID],
})

watch(
	() => submission.doc,
	(doc) => {
		if (doc) {
			code.value = `${boilerplate.value}${doc.code || ''}\n`
			if (testCases.value.length === 0) {
				testCases.value = doc.test_cases || []
			}
		}
	},
	{ immediate: true }
)

const loadFalcon = () => {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = 'https://falcon.frappe.io/static/livecode.js'
		script.onload = resolve
		script.onerror = reject
		document.head.appendChild(script)
	})
}

const submitCode = async () => {
	await runCode()
	createSubmission()
}

const runCode = async () => {
	if (!exercise.doc?.test_cases?.length) return

	testCases.value = []
	if (testCaseSection.value) {
		testCaseSection.value.scrollIntoView({ behavior: 'smooth' })
	}

	for (const test_case of exercise.doc.test_cases) {
		let result = await execute(test_case.input)
		if (error.value) {
			errorMessage.value = result
			break
		} else {
			output.value = result
		}
		let status =
			result.trim() === test_case.expected_output.trim() ? 'Passed' : 'Failed'
		testCases.value.push({
			input: test_case.input,
			output: result,
			expected_output: test_case.expected_output,
			status: status,
		})
	}
}

const createSubmission = () => {
	if (!testCases.value.length) return
	let codeToSave = code.value?.replace(boilerplate.value, '') || ''

	call('lms.lms.api.create_programming_exercise_submission', {
		exercise: props.exerciseID,
		submission: props.submissionID,
		code: codeToSave,
		test_cases: testCases.value,
	})
		.then((data: any) => {
			if (props.submissionID == 'new') {
				router.push({
					name: 'ProgrammingExerciseSubmission',
					params: { exerciseID: props.exerciseID, submissionID: data },
				})
			} else {
				submission.reload()
			}
			toast.success(__('Submitted successfully!'))
		})
		.catch((error: any) => {
			console.error('Error creating submission:', error)
			toast.error(
				__('Failed to submit. Please try again. {0}').format({ error })
			)
		})
}

const execute = (stdin = ''): Promise<string> => {
	return new Promise((resolve, reject) => {
		let outputChunks: string[] = []
		let hasExited = false
		let hasError = false

		let session = new LiveCodeSession({
			base_url: 'https://falcon.frappe.io',
			runtime: 'python',
			code: code.value,
			files: [{ filename: 'stdin', contents: stdin }],
			onMessage: (msg: any) => {
				console.log('msg', msg)

				if (msg.msgtype === 'write' && msg.file === 'stdout') {
					outputChunks.push(msg.data)
				}

				if (msg.msgtype === 'write' && msg.file === 'stderr') {
					hasError = true
					errorMessage.value = msg.data
				}

				if (msg.msgtype === 'exitstatus') {
					hasExited = true
					if (msg.exitstatus !== 0) {
						error.value = true
					} else {
						error.value = false
					}
					resolve(outputChunks.join('').trim())
				}
			},
		})

		setTimeout(() => {
			if (!hasExited) {
				error.value = true
				errorMessage.value = 'Execution timed out.'
				reject('Execution timed out.')
			}
		}, 20000)
	})
}

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Programming Exercise Submissions'),
			route: { name: 'ProgrammingExerciseSubmissions' },
		},
		{ label: exercise.doc?.title },
	]
})

usePageMeta(() => {
	return {
		title: __('Programming Exercise Submission'),
		icon: brand.favicon,
	}
})
</script>
<style>
.ProseMirror pre {
	background: theme('colors.gray.200');
	color: theme('colors.gray.900');
}
</style>
