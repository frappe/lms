<template>
	<PageHeader :breadcrumbs="breadcrumbs">
		<template #actions>
			<!-- The sentence is why the Save button is missing, so it has to stay
			     reachable on a phone. A tooltip would not do it: there is no hover on
			     a touch screen, so the header spells it out where it fits and hands
			     it to a tappable popover where it does not. -->
			<template v-if="isOwnSubmission">
				<!-- No @click: #trigger renders as-child through reka's PopoverTrigger,
				     which wires click, keyboard and aria itself. Toggling by hand as
				     well opened and immediately reclosed it.
				     `sm:hidden` belongs on the button, not on Popover: the component
				     only binds $attrs on its legacy anchor path.
				     The panel is portalled and positioned by `side`/`align`, so it
				     must not carry absolute positioning of its own. -->
				<Popover bare align="end" :offset="8">
					<template #trigger>
						<button
							type="button"
							class="flex items-center p-1 text-ink-gray-5 sm:hidden"
							:aria-label="ownSubmissionNotice"
						>
							<span class="lucide-info size-4" aria-hidden="true" />
						</button>
					</template>
					<template #default>
						<p
							class="w-56 rounded-lg bg-surface-base p-3 text-sm leading-5 text-ink-gray-7 shadow-2xl ring-1 ring-black ring-opacity-5"
						>
							{{ ownSubmissionNotice }}
						</p>
					</template>
				</Popover>

				<span
					class="hidden items-center gap-1.5 text-sm text-ink-gray-7 sm:flex"
				>
					<span class="lucide-info size-4 shrink-0" aria-hidden="true" />
					{{ ownSubmissionNotice }}
				</span>
			</template>
			<template v-else>
				<Badge
					v-if="submissionDetails.isDirty"
					:label="__('Not Saved')"
					variant="subtle"
					theme="orange"
				/>
				<ShortcutTooltip :label="__('Save')" combo="Mod+S">
					<HeaderButton
						:label="__('Save')"
						icon="lucide-check"
						variant="solid"
						@click="saveSubmission()"
					/>
				</ShortcutTooltip>
			</template>
		</template>
	</PageHeader>

	<PageBody>
		<!-- Questions read as the page; the sidebar is a margin note about who sat
		     it and how it went, so it stacks under them once there is no room for
		     a second column. PageBody owns the one scroll box.

		     The title sits in the grid rather than in PageBody's name strip so the
		     sidebar rule starts level with it instead of below a full-width strip.
		     Top padding therefore belongs to each column: on the grid it would sit
		     above the rule and leave the same gap again. -->
		<div
			v-if="submissionDetails.doc"
			class="grid lg:flex-1 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr]"
		>
			<!-- The rule belongs to this column, not to the sidebar blocks: they are
			     only as tall as their own content, so a submission with no
			     violations ended the line halfway down the page. Spanning both rows
			     against a grid that fills the body carries it to the bottom. -->
			<div
				class="order-3 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:border-e"
			>
				<h1 class="text-lg-semibold mb-4 px-5 pt-5 text-ink-gray-9 lg:pe-10">
					{{ submissionDetails.doc.quiz_title }}
				</h1>

				<!-- An attempt cut short by the violation limit can be submitted before
				     a single answer is given, and an empty column beside a populated
				     sidebar reads as a page that failed to load. -->
				<p
					v-if="!submissionDetails.doc.result?.length"
					class="px-5 text-base leading-6 text-ink-gray-5"
				>
					{{ __('No questions were attempted in this submission.') }}
				</p>

				<div v-else class="divide-y">
					<div
						v-for="(row, index) in submissionDetails.doc.result"
						:key="row.name"
						class="flex flex-col gap-3 px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-10 lg:pe-10"
					>
						<div class="min-w-0 space-y-3">
							<!-- The number runs inline with the question rather than beside
							     it. As a flex sibling it made the text its own column, so
							     every wrapped line hung under the first word and indented
							     away from the answer beneath it.
							     Editor content arrives wrapped in <p>: dropped to inline so
							     it stays on the number's line, and stripped of the UA margin
							     this layout never asked for. -->
							<div class="flex items-start gap-2">
								<div
									class="min-w-0 flex-1 text-base leading-6 text-ink-gray-9 [&_p]:m-0 [&_p]:inline"
								>
									<!-- A margin, not whitespace: Vue's `condense` strips a
									     whitespace-only node between two elements when it spans
									     a newline, so the gap has to be a real style. -->
									<span class="me-2 text-ink-gray-4">
										{{ __('Q{0}:').format(index + 1) }}
									</span>
									<span v-safe-html:rich="row.question" />
								</div>
								<span
									class="mt-2 size-1.5 shrink-0 rounded-full"
									:class="markStatusClass(row)"
								/>
							</div>
							<!-- Same shape as the question above: the label runs inline with
							     the text it introduces, so a wrapped answer returns to the
							     left edge instead of hanging under its first word. -->
							<div
								class="text-base leading-6 text-ink-gray-6 [&_p]:m-0 [&_p]:inline"
							>
								<span
									class="me-2 text-xs font-medium uppercase tracking-wide text-ink-gray-4"
								>
									{{ __('Answer:') }}
								</span>
								<span v-safe-html:rich="row.answer" />
							</div>
						</div>
						<!-- Only an open-ended answer is a judgement call; a choice was
						     already marked when it was submitted. -->
						<!-- Stacked, the marks are another labelled line under the answer
						     rather than a figure adrift at the far edge of the screen. -->
						<div class="flex shrink-0 items-center gap-1.5">
							<span
								class="text-xs font-medium uppercase tracking-wide text-ink-gray-4 lg:hidden"
							>
								{{ __('Marks:') }}
							</span>
							<FormControl
								v-if="isOpenEnded"
								v-model="row.marks"
								type="number"
								class="w-20"
							/>
							<span
								v-else
								class="text-sm font-medium text-ink-gray-7 lg:w-20 lg:text-end"
							>
								{{ row.marks }}
							</span>
							<span class="text-sm text-ink-gray-5">
								/ {{ row.marks_out_of }}
							</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Padding lives on each block rather than on the column, so a rule
			     between two of them runs the full width of the sidebar instead of
			     stopping short of the divider it meets.

			     The `order-*` classes are what a phone follows: stacked, the whole
			     sidebar reads as context for the answers rather than a footnote to
			     them, so summary then log then questions. The explicit placement
			     outranks order once there are two columns. -->
			<aside
				class="order-1 border-b lg:order-none lg:col-start-2 lg:row-start-1 lg:border-b-0"
			>
				<div class="flex items-center gap-3 px-5 py-5">
					<Avatar
						:image="memberImage"
						:label="submissionDetails.doc.member_name"
						size="2xl"
					/>
					<div class="min-w-0">
						<div class="truncate text-base text-ink-gray-8">
							{{ submissionDetails.doc.member_name }}
						</div>
						<div class="mt-0.5 text-xs text-ink-gray-5">
							{{ formatDate(submissionDetails.doc.creation) }}
						</div>
					</div>
				</div>

				<div class="border-t px-5 py-5">
					<div class="flex gap-6">
						<div>
							<div class="mb-0.5 text-xs text-ink-gray-5">
								{{ __('Score') }}
							</div>
							<div class="text-sm font-medium text-ink-gray-8">
								{{ submissionDetails.doc.score }} /
								{{ submissionDetails.doc.score_out_of }}
							</div>
						</div>
						<div>
							<div class="mb-0.5 text-xs text-ink-gray-5">
								{{ __('Percentage') }}
							</div>
							<div class="text-sm font-medium text-ink-gray-8">
								{{ submissionDetails.doc.percentage }}%
							</div>
						</div>
						<div v-if="submissionDetails.doc.violation_count">
							<div class="mb-0.5 text-xs text-ink-gray-5">
								{{ __('Violations') }}
							</div>
							<div class="text-sm font-medium text-ink-red-6">
								{{ submissionDetails.doc.violation_count }}
							</div>
						</div>
					</div>
				</div>
			</aside>

			<!-- Sits under the score on a phone, where it collapses: an attempt with
			     a long run of events would otherwise push the first question off the
			     screen. On a desk it is simply open, under the summary.

			     The rule above it is the summary's `border-b` while stacked and its
			     own `lg:border-t` beside it, so the two never double up — and a
			     submission with no violations still gets one from the summary. -->
			<aside
				v-if="submissionDetails.doc.violation_count"
				class="order-2 border-b px-5 py-5 lg:order-none lg:col-start-2 lg:row-start-2 lg:border-b-0 lg:border-t"
			>
				<details
					:open="logOpen"
					class="group"
					@toggle="logOpen = $event.target.open"
				>
					<summary
						class="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden lg:cursor-default lg:pointer-events-none"
					>
						<h2 class="text-sm font-semibold text-ink-gray-7">
							{{ __('Proctoring Log') }}
						</h2>
						<span
							v-if="violationLog.data?.length"
							class="text-sm text-ink-gray-4"
						>
							({{ violationLog.data.length }})
						</span>
						<span
							class="lucide-chevron-down ms-auto size-4 shrink-0 text-ink-gray-5 transition-transform group-open:rotate-180 lg:hidden"
						/>
					</summary>

					<div class="mt-4">
						<!-- The rule runs behind the markers rather than between them,
						     so the events read as one run of time. -->
						<ol
							v-if="violationLog.data?.length"
							class="border-s border-outline-gray-2 ps-4"
						>
							<li
								v-for="entry in violationLog.data"
								:key="`${entry.event_type}-${entry.timestamp}`"
								class="relative pb-4 last:pb-0"
							>
								<span
									class="absolute -start-[21px] top-1 size-2 rounded-full"
									:class="
										entry.severity === 'violation'
											? 'bg-ink-red-6'
											: 'bg-ink-orange-6'
									"
								/>
								<div class="text-xs font-medium leading-5 text-ink-gray-7">
									{{
										violationEventLabels[entry.event_type] || entry.event_type
									}}
								</div>
								<div class="mt-0.5 flex items-center gap-1 text-xs leading-5">
									<span
										class="font-medium"
										:class="
											entry.severity === 'violation'
												? 'text-ink-red-6'
												: 'text-ink-orange-6'
										"
									>
										{{ severityLabel(entry.severity) }}
									</span>
									<span class="text-ink-gray-4">
										· {{ formatTime(entry.timestamp) }}
									</span>
								</div>
								<!-- What the camera saw as the event fired, behind a disclosure:
								     a run of full-size stills buries the timeline it belongs to,
								     and the log is read to find the moment worth looking at
								     rather than to look at all of them.
								     Absent on events recorded before frames were captured, and
								     on a camera disconnect, where there was nothing left to
								     draw — so the entry stands without it. -->
								<details v-if="safeUrl(entry.frame)" class="group mt-1.5">
									<!-- Subordinate to the event it belongs to: the timeline is
									     read for what happened and when, and the snapshot is the
									     follow-up. The label states what opening it costs the
									     reader, and swaps on open so the control still describes
									     what it does. -->
									<summary
										class="w-fit cursor-pointer list-none text-xs text-ink-gray-5 underline decoration-outline-gray-2 underline-offset-2 hover:text-ink-gray-7 hover:decoration-ink-gray-7 [&::-webkit-details-marker]:hidden"
									>
										{{ __('Snapshot') }}
									</summary>
									<a
										v-external
										:href="safeUrl(entry.frame)"
										class="mt-1.5 block"
									>
										<img
											:src="safeUrl(entry.frame)"
											:alt="
												__('Camera at {0}').format(
													violationEventLabels[entry.event_type] ||
														entry.event_type
												)
											"
											class="w-full rounded border"
										/>
									</a>
								</details>
							</li>
						</ol>

						<!-- The count is stored on the submission but the events are
						     sent separately, so a submission can be flagged with
						     nothing to show: say so rather than leave it blank. -->
						<p v-else class="text-xs leading-5 text-ink-gray-5">
							{{ __('No event details were recorded for this attempt.') }}
						</p>
					</div>
				</details>
			</aside>
		</div>
	</PageBody>
</template>

<script setup>
import {
	createDocumentResource,
	createResource,
	FormControl,
	Badge,
	Avatar,
	Popover,
	usePageMeta,
	toast,
} from 'frappe-ui'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDebounceFn, useMediaQuery } from '@vueuse/core'
import { safeUrl } from '@/utils/safeUrl'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import PageBody from '@/components/Layouts/PageBody.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import ShortcutTooltip from '@/components/ShortcutTooltip.vue'
import {
	useKeyboardShortcuts,
	saveShortcut,
} from '@/composables/useKeyboardShortcuts'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'

const { brand } = sessionStore()
const router = useRouter()
const user = inject('$user')

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator)
		router.push({ name: 'Courses' })
})

useKeyboardShortcuts({
	ignoreTyping: false,
	shortcuts: [
		{
			...saveShortcut(() => saveSubmission()),
			guard: (e) => !e.target?.classList?.contains('ProseMirror'),
		},
	],
})

const props = defineProps({
	submission: {
		type: String,
		required: true,
	},
})

const submissionDetails = createDocumentResource({
	doctype: 'LMS Quiz Submission',
	name: props.submission,
	auto: true,
})

const violationLog = createResource({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.get_quiz_violation_logs',
	makeParams() {
		return { submission: props.submission }
	},
	auto: true,
})

const openEndedCheck = createResource({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.is_open_ended_submission',
	makeParams() {
		return { submission: props.submission }
	},
	auto: true,
})

const isOpenEnded = computed(() => !!openEndedCheck.data)

// Said in two places — the header spells it out, the popover carries it on a
// phone — so it is written once.
const ownSubmissionNotice = __('You cannot grade your own submission.')

const violationEventLabels = {
	tab_switch: __('Tab switched'),
	no_face: __('No face detected'),
	multiple_faces: __('Multiple faces'),
	focus_loss: __('Window focus lost'),
	camera_disconnect: __('Camera disconnected'),
}

// The submission carries the member's id but not their picture, and the doc
// lands after this page mounts, so the avatar is fetched once it does.
const memberImageResource = createResource({
	url: 'frappe.client.get_value',
	makeParams() {
		return {
			doctype: 'User',
			filters: submissionDetails.doc?.member || '',
			fieldname: 'user_image',
		}
	},
	auto: false,
})

watch(
	() => submissionDetails.doc?.member,
	(member) => {
		if (member) memberImageResource.fetch()
	},
	{ immediate: true }
)

const memberImage = computed(() => memberImageResource.data?.user_image || '')

const formatDate = (value) => {
	if (!value) return ''
	return new Date(value).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

const formatTime = (value) => {
	if (!value) return ''
	return new Date(value).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}

// Matches the `lg` breakpoint the sidebar itself switches on. useScreenSize()
// reports mobile below 640px, which would leave the log expanded through the
// whole band where it is already stacked full-width under the answers.
//
// Seeded into a ref rather than bound to `open` directly: bound, every render
// would re-assert the query and spring the panel back open under a reader who
// had just collapsed it. The @toggle handler writes their choice back.
const isDesktop = useMediaQuery('(min-width: 1024px)')
const logOpen = ref(isDesktop.value)

watch(isDesktop, (desktop) => {
	logOpen.value = desktop
})

// The log stores only these two severities, so anything else reads as the
// milder of them rather than surfacing a raw value.
const severityLabel = (severity) =>
	severity === 'violation' ? __('Violation') : __('Warning')

const markStatusClass = (row) => {
	if (row.marks == row.marks_out_of) return 'bg-ink-green-6'
	return row.marks > 0 ? 'bg-ink-orange-6' : 'bg-ink-red-6'
}

// The header renders before the doc lands. It used to be guarded by a `v-if`
// on Breadcrumbs itself, and reading `.quiz` off an undefined doc threw during
// render once the shared header took that guard away.
//
// The trail continues the submission list's own — Quizzes, the quiz, then its
// submissions — so arriving here from that list adds a crumb rather than
// replacing the path that led to it.
const breadcrumbs = computed(() => {
	const crumbs = [{ label: __('Quizzes'), route: { name: 'Quizzes' } }]
	const doc = submissionDetails.doc
	if (!doc) return crumbs

	if (doc.quiz_title) {
		crumbs.push({
			label: doc.quiz_title,
			route: { name: 'QuizForm', params: { quizID: doc.quiz } },
		})
	}
	crumbs.push({
		label: __('Submissions'),
		route: { name: 'QuizSubmissionList', params: { quizID: doc.quiz } },
	})
	crumbs.push({ label: doc.member_name || doc.name })
	return crumbs
})

const isOwnSubmission = computed(
	() =>
		user.data?.is_instructor &&
		submissionDetails.doc?.member === user.data?.name
)

const saveSubmission = (opts = {}) => {
	if (isOwnSubmission.value) return
	submissionDetails.save.submit(
		{},
		{
			onSuccess() {
				if (!opts.silent) toast.success(__('Saved'))
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

// Marks are typed one field at a time, so the grade is committed as it is
// entered rather than left to a Save the grader may never press.
const autoSave = useDebounceFn(() => {
	if (submissionDetails.isDirty) saveSubmission({ silent: true })
}, 1000)

watch(
	() => submissionDetails.isDirty,
	(dirty) => {
		if (dirty) autoSave()
	}
)

onBeforeUnmount(() => {
	if (submissionDetails.isDirty) saveSubmission({ silent: true })
})

usePageMeta(() => ({
	title: `${submissionDetails.doc?.quiz_title}`,
	icon: brand.favicon,
}))
</script>
