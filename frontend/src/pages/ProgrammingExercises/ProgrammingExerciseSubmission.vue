<template>
	<PageHeader
		v-if="!fromLesson && !preview && !embedded"
		:breadcrumbs="breadcrumbs"
	/>
	<div
		v-if="falconError"
		class="flex items-center justify-between p-3 text-sm bg-surface-amber-1 text-ink-amber-2"
	>
		<span>
			{{ falconError }}
		</span>
		<Button v-if="user.data?.is_moderator" @click="openSettings('general')">
			<template #prefix>
				<span class="lucide-settings size-4" />
			</template>
			{{ __('Settings') }}
		</Button>
	</div>
	<div ref="root" class="flex flex-col" :class="rootClass">
		<div class="min-h-0 flex-1">
			<ExerciseWorkspaceSkeleton v-if="loading" />
			<ExerciseWorkspace
				v-else
				:framed="embedded || preview"
				:title="exercise?.title ?? ''"
				:language="exercise?.language ?? ''"
				:problemStatement="exercise?.problem_statement ?? ''"
				:results="results"
				:consoleLines="consoleLines"
				:duration="duration"
				:running="running"
				:canRun="canRun"
				:saved="saved"
				:submissionStatus="submissionDoc?.status"
				@run="submitCode"
				@reset="resetCode"
			>
				<template #editor>
					<ExerciseCodeEditor
						:modelValue="code"
						@update:modelValue="editCode"
						:language="editorLanguage"
						:readonly="running"
						:label="__('Your Code')"
					/>
				</template>
			</ExerciseWorkspace>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	Button,
	call,
	createDocumentResource,
	toast,
	usePageMeta,
	type FrappeResourceError,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, shallowRef, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import ExerciseCodeEditor from '@/components/ProgrammingExercises/ExerciseCodeEditor.vue'
import ExerciseWorkspace from '@/components/ProgrammingExercises/ExerciseWorkspace.vue'
import ExerciseWorkspaceSkeleton from '@/components/ProgrammingExercises/ExerciseWorkspaceSkeleton.vue'
import type { TestCaseResult } from '@/components/ProgrammingExercises/ExerciseTestCases.vue'
import type { ConsoleLine } from '@/components/ProgrammingExercises/ExerciseConsole.vue'
import { sessionStore } from '@/stores/session'
import router from '@/router'
import { openSettings } from '@/utils'
import { useSettings } from '@/stores/settings'
import { getLmsRoute } from '@/utils/basePath'
import { provideStudentView } from '@/composables/useStudentView'
import type { UserResource } from '@/composables/useStudentView'
import { useExerciseDraft } from '@/composables/useExerciseDraft'
import {
	loadLiveCode,
	runLiveCode,
} from '@/pages/ProgrammingExercises/liveCode'
import {
	sameBlock,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'
import {
	boilerplateFor,
	collectOutputs,
	draftWriter,
	messageOf,
	orderCasesForRun,
	restoredResults,
	runnerCommand,
	sourceFilename,
} from '@/pages/ProgrammingExercises/exerciseRunFlow'
import type {
	ExerciseTestCase,
	StoredTestCase,
} from '@/pages/ProgrammingExercises/exerciseRunFlow'
import type { ExerciseLanguage } from '@/types'
// @ts-expect-error utils/dialogs.js has no type declarations yet
import { createDialog } from '@/utils/dialogs'

type Exercise = {
	name: string
	title: string
	language: string
	problem_statement: string
	starter_code: string | null
	test_cases: ExerciseTestCase[]
}

type ScoredCase = Omit<TestCaseResult, 'input' | 'elapsed'>

const props = withDefaults(
	defineProps<{
		exerciseID: string
		submissionID?: string
		preview?: boolean
		// Mounted inline in a lesson: no page chrome, no navigation.
		embedded?: boolean
		studentView?: boolean
	}>(),
	{
		submissionID: 'new',
		preview: false,
		embedded: false,
		studentView: false,
	}
)

const realUser = inject<UserResource>('$user')!

// Student View arrives as a prop in a lesson, or in the URL on old links. The
// page reads the masked user itself, since its own template checks roles.
const studentViewInURL =
	new URLSearchParams(window.location.search).get('studentView') === '1'
const { mockedUser: user } = provideStudentView(
	realUser,
	() => props.studentView || studentViewInURL
)
const code = ref<string>('')
const exercise = ref<Exercise | null>(null)
const results = ref<TestCaseResult[]>([])
const consoleLines = ref<ConsoleLine[]>([])
const duration = ref<number | null>(null)
const { brand } = sessionStore()
const { settings } = useSettings()
const fromLesson = ref(false)
const root = ref<HTMLElement | null>(null)
const falconURL = ref<string>('https://falcon.frappe.io')
const falconError = ref<string | undefined>(undefined)
const running = ref<boolean>(false)
const exerciseLoading = ref<boolean>(true)
const falconReady = ref<boolean>(false)

const userName = computed<string>(() => String(user.data?.name ?? ''))
const exerciseID = computed<string>(() => props.exerciseID)
const {
	draft,
	save: saveDraft,
	clear: clearDraft,
	saved,
} = useExerciseDraft(exerciseID, userName)

onMounted(() => {
	checkIfUserIsPermitted()
	checkIfInLesson()
	fetchSubmission()
	loadExercise()
	// falconError was declared, rendered and used to gate Run, but nothing ever
	// assigned it: a runtime that failed to load said nothing at all, and the
	// author found out twenty seconds later as "Execution timed out".
	loadFalcon()
		.then(() => {
			falconReady.value = true
		})
		.catch(() => {
			falconError.value = __(
				'The code runner could not be loaded, so this exercise cannot be run.'
			)
		})
})

const checkIfInLesson = () => {
	if (new URLSearchParams(window.location.search).get('fromLesson')) {
		fromLesson.value = true
	}
}

// Starts as the prop and becomes the real name after the first save, so a
// second Run updates it instead of inserting another submission.
const submissionID = ref<string>(props.submissionID)

watch(
	() => props.submissionID,
	(name) => {
		if (name === submissionID.value) return
		submissionID.value = name
		results.value = []
		consoleLines.value = []
		duration.value = null
		submission.value = name === 'new' ? null : submissionFor(name)
		submission.value?.reload()
	}
)

const rootClass = computed<string>(() => {
	if (props.embedded) return 'h-[900px]'
	if (props.preview) return 'h-full'
	return 'h-[calc(100vh_-_3rem)]'
})

const fetchSubmission = (name: string = '') => {
	if (name) submission.value = submissionFor(name)
	return submission.value?.reload()
}

// Not createDocumentResource: a learner must never receive a hidden case's
// expected output, and only this endpoint withholds it.
const loadExercise = async () => {
	const requested = props.exerciseID
	exerciseLoading.value = true
	try {
		const data: Exercise = await call('lms.lms.api.get_programming_exercise', {
			exercise: requested,
		})
		// The page can be pointed at another exercise without remounting, so a
		// late reply for the one the learner has left must not land.
		if (requested !== props.exerciseID) return
		exercise.value = data
		applySourceCode()
		restoreResults()
	} catch (failure: unknown) {
		if (requested !== props.exerciseID) return
		toast.error(messageOf(failure))
	}
	if (requested === props.exerciseID) exerciseLoading.value = false
}

watch(exerciseID, () => {
	// Cleared before the fetch: if it fails, stored rows would otherwise be
	// mapped against the previous exercise and could show a hidden answer.
	exercise.value = null
	results.value = []
	consoleLines.value = []
	duration.value = null
	loadExercise()
})

// Only the first load shows the skeleton: the resource reloads after every
// submit, and swapping the workspace out then would reset its editor.
const submissionPending = ref<boolean>(props.submissionID != 'new')
const loading = computed<boolean>(
	() => exerciseLoading.value || submissionPending.value
)

const submissionFor = (name: string) =>
	createDocumentResource({
		doctype: 'LMS Programming Exercise Submission',
		name,
		auto: false,
		onError: onSubmissionError,
	})

const onSubmissionError = (error: FrappeResourceError) => {
	submissionPending.value = false
	if (error.messages?.[0]?.includes('not found')) {
		submissionID.value = 'new'
		submission.value = null
		if (props.embedded) return
		router.push({
			name: 'ProgrammingExerciseSubmission',
			params: { exerciseID: props.exerciseID, submissionID: 'new' },
		})
	} else {
		toast.error(__(error.messages?.[0] || error.message))
	}
}

// frappe-ui caches document resources per name, so every block holding 'new'
// would share one. A resource exists only for a real name.
const submission = shallowRef(
	props.submissionID === 'new' ? null : submissionFor(props.submissionID)
)
const submissionDoc = computed(() => submission.value?.doc ?? null)

// Viewing someone else's submission neither reads nor writes this viewer's draft.
const ownsSubmission = computed<boolean>(
	() =>
		submissionID.value == 'new' || user.data?.name == submissionDoc.value?.owner
)

const boilerplate = computed<string>(() =>
	boilerplateFor(exercise.value?.language)
)

const startingCode = computed<string>(
	() => exercise.value?.starter_code || boilerplate.value
)

const editorLanguage = computed<ExerciseLanguage>(() =>
	exercise.value?.language === 'JavaScript' ? 'JavaScript' : 'Python'
)

const runCommand = computed<string>(
	() =>
		`${runnerCommand(exercise.value?.language)} ${sourceFilename(
			exercise.value?.language
		)}`
)

// Submissions store the code minus the boilerplate, unless the learner edited
// the boilerplate. Starter code is stored whole.
const storedPrefix = computed<string>(() =>
	exercise.value?.starter_code ? '' : boilerplate.value
)

// Only the learner's own edits arm a draft; code the page puts in the editor does not.
const editCode = (value: string) => {
	code.value = value
	if (ownsSubmission.value) writeDraft(draftGeneration.value, value)
}

const applySourceCode = () => {
	if (ownsSubmission.value && draft.value !== null) {
		code.value = draft.value
		return
	}
	const submitted: string = submissionDoc.value?.code || ''
	if (!submitted) {
		code.value = startingCode.value
	} else if (
		submissionDoc.value?.full_code ||
		submitted.startsWith(storedPrefix.value)
	) {
		// full_code: stored whole because the learner edited the boilerplate, so
		// adding it back would run it twice (a second `const fs` breaks JavaScript).
		code.value = submitted
	} else {
		code.value = `${storedPrefix.value}${submitted}`
	}
}

// A draft that arrives later, or under a new exercise key, replaces the
// editor. A draft going null does not: that is clear() after a submit.
watch(
	draft,
	(value) => {
		if (ownsSubmission.value && value !== null && value !== code.value)
			code.value = value
	},
	{ immediate: true }
)

// save() reads the key when it fires, so a write armed under one exercise
// could land under the next. The generation drops it; neither debounce has
// cancel().
const draftGeneration = ref(0)

watch([exerciseID, userName], () => {
	draftGeneration.value += 1
})

const writeDraft = useDebounceFn(
	draftWriter(saveDraft, () => draftGeneration.value),
	800
)

// Inline, AssessmentBlock has already gated on a session, and moving the
// lesson's own route to another page would take the learner off the lesson.
const checkIfUserIsPermitted = (doc: any = null) => {
	if (props.embedded) return
	if (!user.data) {
		const redirectPath = getLmsRoute(
			`programming-exercise-submission/${props.exerciseID}/${props.submissionID}`
		)
		window.location.href = `/login?redirect-to=${redirectPath}`
	}

	if (!doc) return
	if (
		doc.owner != user.data?.name &&
		!user.data?.is_instructor &&
		!user.data?.is_moderator &&
		!user.data?.is_evaluator
	) {
		router.push({
			name: 'Courses',
		})
		return
	}
}

// Needs both resources: visibility of a stored row is read from the exercise.
// A no-op until then, so the call after the exercise lands is not blocked.
const restoreResults = () => {
	if (results.value.length) return
	if (!exercise.value) return
	const stored: StoredTestCase[] = submissionDoc.value?.test_cases || []
	if (!stored.length) return
	results.value = restoredResults(stored, exercise.value.test_cases)
}

// After a save, the stored rows are the server's own run of the code: the verdict
// that counts. They replace this run's rows so the screen matches it; only the
// timings, which the server does not keep, carry over. Returns whether any
// verdict changed.
const showSavedResults = (ran: TestCaseResult[]): boolean => {
	const stored: StoredTestCase[] = submissionDoc.value?.test_cases || []
	if (!exercise.value || !stored.length) return false
	const byIdx = new Map(ran.map((row) => [row.idx, row]))
	results.value = restoredResults(stored, exercise.value.test_cases).map(
		(row) => ({ ...row, elapsed: byIdx.get(row.idx)?.elapsed ?? null })
	)
	return results.value.some((row) => row.status !== byIdx.get(row.idx)?.status)
}

watch(
	submissionDoc,
	(doc) => {
		if (doc) {
			submissionPending.value = false
			checkIfUserIsPermitted(doc)
			restoreResults()
			applySourceCode()
		}
	},
	{ immediate: true }
)

const loadFalcon = async (): Promise<void> => {
	// The settings resource is auto-fetched and has not necessarily landed by
	// the time this page mounts. Reading livecode_url too early falls back to
	// the public default and loads a runtime the site did not ask for.
	if (!settings.data) await settings.promise
	// An unset livecode_url leaves the default in place rather than building
	// `undefined/static/livecode.js`.
	if (settings.data?.livecode_url) {
		falconURL.value = settings.data.livecode_url
	}
	await loadLiveCode(`${falconURL.value}/static/livecode.js`)
}

const canRun = computed<boolean>(
	() => falconReady.value && !falconError.value && ownsSubmission.value
)

const submitCode = async () => {
	if (running.value || !canRun.value) return
	running.value = true
	try {
		await runCode()
		await createSubmission()
	} finally {
		running.value = false
	}
}

const runCode = async () => {
	// The endpoint wants one output per case in idx order, so the run and the
	// merge below both walk this one ordered list.
	const cases: ExerciseTestCase[] = orderCasesForRun(
		exercise.value?.test_cases ?? []
	)
	if (!cases.length) return

	results.value = []
	consoleLines.value = []
	duration.value = null
	const startedAt = performance.now()

	const collected = await collectOutputs({
		cases,
		command: runCommand.value,
		execute,
		onLine: (line) => consoleLines.value.push(line),
	})
	if (!collected) return
	const { outputs, elapsed } = collected

	// Scored on the server: the browser holds each input by necessity, but it
	// must never hold a hidden case's answer to compare against.
	let scored: ScoredCase[]
	try {
		scored = await call('lms.lms.api.evaluate_programming_exercise', {
			exercise: props.exerciseID,
			outputs,
		})
	} catch (failure: unknown) {
		consoleLines.value.push({ text: messageOf(failure), stream: 'stderr' })
		toast.error(__('The run could not be scored. Please try again.'))
		return
	}

	results.value = scored.map((row: ScoredCase, index: number) => ({
		...row,
		input: cases[index]?.input,
		elapsed: elapsed[index] ?? null,
	}))
	duration.value = (performance.now() - startedAt) / 1000
}

const resetCode = () => {
	if (code.value === startingCode.value) {
		applyReset()
		return
	}
	createDialog({
		title: __('Start again?'),
		message: __(
			'This replaces what is in the editor with the starting code. Your run results are cleared too.'
		),
		actions: [
			{
				label: __('Reset'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					applyReset()
					close()
				},
			},
		],
	})
}

const applyReset = () => {
	clearDraft()
	code.value = startingCode.value
	results.value = []
	consoleLines.value = []
	duration.value = null
}

const inThisBlock = sameBlock(root)

useKeyboardShortcuts({
	// The learner is typing in the editor when they reach for these, so the
	// default "ignore keys pressed in an input" would swallow both.
	ignoreTyping: false,
	shortcuts: [
		{
			match: (e) =>
				(e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'Enter',
			guard: inThisBlock,
			action: () => {
				submitCode()
			},
		},
	],
})

const createSubmission = async () => {
	// Guarded here, not on the button, because Mod+Enter reaches it too. A
	// preview would otherwise write a real submission under the author's name.
	if (props.preview) return
	if (!results.value.length) return
	// Sent whole: the server runs the code the run here used and scores it itself
	// rather than taking these results on trust, then strips the boilerplate to store.
	return call<string>('lms.lms.api.create_programming_exercise_submission', {
		exercise: props.exerciseID,
		submission: submissionID.value,
		code: code.value,
	})
		.then(async (name) => {
			clearDraft()
			const created = submissionID.value == 'new'
			submissionID.value = name
			if (created && !props.embedded) {
				router.push({
					name: 'ProgrammingExerciseSubmission',
					params: { exerciseID: props.exerciseID, submissionID: name },
				})
			}
			const ran = results.value
			await fetchSubmission(name)
			if (showSavedResults(ran)) {
				toast.warning(
					__(
						'Saved, but the result differs from this run. The saved result is shown.'
					)
				)
			} else {
				toast.success(__('Submission saved!'))
			}
		})
		.catch((error: any) => {
			console.error('Error creating submission:', error)
			toast.error(
				__('Failed to submit. Please try again. {0}').format({ error })
			)
		})
}

const execute = (stdin = ''): Promise<string> =>
	runLiveCode({
		baseUrl: falconURL.value,
		runtime: exercise.value?.language.toLowerCase() || 'python',
		code: code.value,
		stdin,
		onStderr: (text) => consoleLines.value.push({ text, stream: 'stderr' }),
	})

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Programming Exercises'),
			route: { name: 'ProgrammingExercises' },
		},
		{
			label: __('Submissions'),
			route: { name: 'ProgrammingExerciseSubmissions' },
		},
		{ label: exercise.value?.title ?? '' },
	]
})

// Inline, the page title belongs to the lesson.
if (!props.embedded && !props.preview) {
	usePageMeta(() => {
		return {
			title: __('Programming Exercise Submission'),
			icon: brand.favicon,
		}
	})
}
</script>
