<template>
	<header
		v-if="!fromLesson"
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div
		v-if="falconError"
		class="flex items-center justify-between p-3 text-sm bg-surface-amber-1 text-ink-amber-3"
	>
		<span>
			{{ falconError }}
		</span>
		<Button v-if="user.data?.is_moderator" @click="openSettings('General')">
			<template #prefix>
				<Settings class="size-4 stroke-1.5" />
			</template>
			{{ __('Settings') }}
		</Button>
	</div>
	<div class="grid grid-cols-2 h-[calc(100vh_-_3rem)]">
		<div class="border-r py-5 px-8 h-full">
			<div class="font-semibold mb-2">
				{{ __('Problem Statement') }}
			</div>
			<div
				v-html="exercise.doc?.problem_statement"
				class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal"
			></div>
		</div>
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
					<Button
						v-if="
							!falconError &&
							(submissionID == 'new' ||
								user.data?.name == submission.doc?.owner)
						"
						variant="solid"
						@click="submitCode"
					>
						<template #prefix>
							<Play class="size-3" />
						</template>
						{{ __('Run') }}
					</Button>
				</div>
			</div>
			<div class="flex flex-col space-y-4 pt-5 border-b">
				<Code
					v-model="code"
					:language="exercise.doc?.language.toLowerCase()"
					height="400px"
					maxHeight="1000px"
				/>
				<div class="flex flex-col space-y-1">
					<span v-if="error" class="text-xs text-ink-gray-5 px-1">
						{{ __('Compiler Message') }}:
					</span>
					<textarea
						v-if="error"
						v-model="errorMessage"
						class="font-mono text-ink-red-3 bg-surface-gray-1 border-none text-sm h-32 leading-6"
						readonly
					/>
				</div>
				<!-- <textarea v-else v-model="output" class="bg-surface-gray-1 border-none text-sm h-28 leading-6" readonly /> -->
			</div>

			<div ref="testCaseSection" class="p-5">
				<span class="text-lg font-semibold text-ink-gray-9">
					{{ __('Test Cases') }}
				</span>
				<div v-if="testCases.length" class="divide-y mt-5">
					<div
						v-for="(testCase, index) in testCases"
						:key="testCase.input"
						class="py-3"
					>
						<div class="flex items-center mb-3">
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
							<!-- <span v-if="testCase.status === 'Passed'">
								<Check class="size-4 text-ink-green-3" />
							</span>
							<span v-else>
								<X class="size-4 text-ink-red-3" />
							</span> -->
						</div>
						<div class="flex items-center justify-between w-[60%]">
							<div v-if="testCase.input" class="space-y-2">
								<div class="text-xs text-ink-gray-7">
									{{ __('Input') }}
								</div>
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
				<div v-else class="text-sm text-ink-gray-6 mt-4">
					{{ __('Please run the code to execute the test cases.') }}
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
import { computed, inject, onMounted, ref, watch } from 'vue'
import { Play, X, Check, Settings } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { openSettings } from '@/utils'

const user = inject<any>('$user')
const code = ref<string | null>('')
const output = ref<string | null>(null)
const error = ref<boolean | null>(null)
const errorMessage = ref<string | null>(null)
const testCaseSection = ref<HTMLElement | null>(null)
const testCases = ref<TestCase[]>([])
const boilerplate = ref<string>('')
const { brand, livecodeURL } = sessionStore()
const router = useRouter()
const fromLesson = ref(false)
const falconURL = ref<string>('https://falcon.frappe.io/')
const falconError = ref<string | null>(null)

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
	checkIfUserIsPermitted()
	checkIfInLesson()
	fetchSubmission()
})

const checkIfInLesson = () => {
	if (new URLSearchParams(window.location.search).get('fromLesson')) {
		fromLesson.value = true
	}
}

const fetchSubmission = (name: string = '') => {
	if (name) {
		submission.name = name
		submission.reload()
	} else if (props.submissionID != 'new') {
		submission.reload()
	}
}

const exercise = createDocumentResource({
	doctype: 'LMS Programming Exercise',
	name: props.exerciseID,
	cache: ['programmingExercise', props.exerciseID],
	auto: true,
})

const submission = createDocumentResource({
	doctype: 'LMS Programming Exercise Submission',
	name: props.submissionID,
	auto: false,
	onError(error: any) {
		if (error.messages?.[0].includes('not found')) {
			router.push({
				name: 'ProgrammingExerciseSubmission',
				params: { exerciseID: props.exerciseID, submissionID: 'new' },
			})
		} else {
			toast.error(__(error.messages?.[0] || error))
		}
	},
})

watch(exercise, () => {
	updateCode()
})

const updateCode = (submissionCode = '') => {
	updateBoilerPlate()
	if (!code.value?.includes(boilerplate.value)) {
		code.value = `${boilerplate.value}${code.value}`
	}
	if (submissionCode && !code.value?.includes(submissionCode)) {
		code.value = `${code.value}${submissionCode}`
	} else if (!submissionCode && !code.value) {
		code.value = boilerplate.value
	}
}

const updateBoilerPlate = () => {
	if (exercise.doc?.language == 'Python') {
		boilerplate.value = `with open("stdin", "r") as f:\n    data = f.read()\n\ninputs = data.split() if len(data) else []\n\n# inputs is a list of strings\n# write your code below\n\n`
	} else if (exercise.doc?.language == 'JavaScript') {
		boilerplate.value = `const fs = require('fs');\n\nlet input = fs.readFileSync('/app/stdin', 'utf8').trim();\nconst inputs = input.split("\\n");\n// inputs is an array of strings\n// write your code below\n`
	}
}

const checkIfUserIsPermitted = (doc: any = null) => {
	if (!user.data) {
		window.location.href = `/login?redirect-to=/lms/programming-exercises/${props.exerciseID}/submission/${props.submissionID}`
	}

	if (!doc) return
	if (
		doc.owner != user.data?.name &&
		!user.data?.is_instructor &&
		!user.data?.is_moderator &&
		!user.data.is_evaluator
	) {
		router.push({
			name: 'ProgrammingExerciseSubmission',
			params: { exerciseID: props.exerciseID, submissionID: 'new' },
		})
		return
	}
}

const updateTestCases = (doc: any) => {
	if (testCases.value.length === 0) {
		testCases.value = doc.test_cases || []
	}
}

watch(
	() => submission.doc,
	(doc) => {
		if (doc) {
			checkIfUserIsPermitted(doc)
			updateTestCases(doc)
			updateCode(doc.code)
		}
	},
	{ immediate: true }
)

const loadFalcon = () => {
	if (livecodeURL.data) {
		falconURL.value = livecodeURL.data
	}
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = `${falconURL.value}static/livecode.js`
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
				fetchSubmission(data)
			} else {
				fetchSubmission(props.submissionID)
			}
			toast.success(__('Submission saved!'))
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
			base_url: falconURL.value,
			runtime: exercise.doc?.language.toLowerCase() || 'python',
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
