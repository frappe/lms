<template>
	<AssessmentCard
		v-if="quiz.loading && !quiz.data"
		aria-busy="true"
		data-testid="quiz-skeleton"
	>
		<AssessmentCardHeader icon="lucide-circle-help" :title="__('Quiz')" />
		<div class="space-y-4 p-3.5">
			<Skeleton class="h-5 w-1/3 rounded-4" />
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Skeleton v-for="i in 4" :key="i" class="h-14 rounded-6" />
			</div>
			<div class="flex justify-end">
				<Skeleton class="h-8 w-24 rounded-4" />
			</div>
		</div>
	</AssessmentCard>
	<div v-else-if="quiz.data" class="space-y-4">
		<AssessmentCard>
			<AssessmentCardHeader
				icon="lucide-circle-help"
				:title="__('Quiz')"
				:subtitle="quizSubtitle"
			>
				<Badge v-if="quiz.data.enable_proctoring" theme="amber" size="sm">
					{{ __('Proctored') }}
				</Badge>
				<span
					v-if="attemptsLeft !== null"
					class="hidden text-xs text-ink-gray-6 sm:inline"
				>
					{{ attemptsLeftLabel(attemptsLeft) }}
				</span>
				<Badge
					v-if="
						activeQuestion > 0 && !quizSubmission.data && quiz.data.duration
					"
					data-testid="quiz-timer"
					size="sm"
					:theme="timerTheme"
				>
					<template #prefix>
						<span class="lucide-timer size-3" />
					</template>
					{{ formatTimer(timer) }}
				</Badge>
			</AssessmentCardHeader>

			<div
				v-if="
					activeQuestion > 0 &&
					!quizSubmission.data &&
					quiz.data.enable_proctoring
				"
				class="flex justify-end border-b border-outline-gray-1 px-3.5 py-2"
			>
				<ProctoringMonitor
					:max-violations="quiz.data.max_violations"
					:active="proctoringActive"
					:violation-count="violationCount"
					@violation="handleViolation"
					@warning="handleWarning"
					@camera-ready="() => {}"
					@camera-denied="() => {}"
				/>
			</div>

			<div v-if="activeQuestion == 0">
				<div
					v-if="introTips.length && questions.length && !attemptsExhausted"
					class="space-y-2 border-b border-outline-gray-1 p-3.5"
				>
					<div class="text-sm text-ink-gray-6">
						{{ __('Before you start') }}
					</div>
					<ol class="space-y-1.5">
						<li
							v-for="(tip, index) in introTips"
							:key="index"
							class="flex gap-x-2 text-p-base text-ink-gray-7"
						>
							<span class="shrink-0 font-mono text-ink-gray-4">
								{{ index + 1 }}
							</span>
							<span>{{ tip }}</span>
						</li>
					</ol>
				</div>

				<div class="space-y-3.5 p-3.5">
					<div class="text-base-semibold text-ink-gray-9">
						{{ quiz.data.title }}
					</div>
					<QuizStats
						:questions="questions.length"
						:duration="quiz.data.duration"
						:passingPercentage="quiz.data.passing_percentage"
						:attemptsLeft="attemptsLeft"
					/>

					<div
						v-if="
							quiz.data.enable_scheduling &&
							(quiz.data.schedule_start || quiz.data.schedule_end)
						"
						class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-gray-6"
					>
						<span
							v-if="quiz.data.schedule_start"
							class="inline-flex items-center gap-1.5"
						>
							<span class="lucide-calendar size-3.5" />
							{{ __('Opens') }}:
							{{
								formatScheduleDate(
									quiz.data.schedule_start_iso || quiz.data.schedule_start
								)
							}}
						</span>
						<span
							v-if="quiz.data.schedule_end"
							class="inline-flex items-center gap-1.5"
						>
							<span class="lucide-calendar-x size-3.5" />
							{{ __('Closes') }}:
							{{
								formatScheduleDate(
									quiz.data.schedule_end_iso || quiz.data.schedule_end
								)
							}}
						</span>
					</div>

					<template v-if="!questions.length">
						<p class="text-p-base text-ink-gray-6">
							{{ __('This quiz has no questions available yet.') }}
						</p>
						<Button v-if="inVideo" @click="props.backToVideo()">{{
							__('Resume Video')
						}}</Button>
					</template>
					<template v-else-if="attemptsExhausted">
						<FeedbackBanner :correct="false">
							{{
								__(
									"You've used all {0} {1} for this quiz. Reach out to your instructor if you need to try again."
								).format(
									quiz.data.max_attempts,
									quiz.data.max_attempts == 1 ? __('attempt') : __('attempts')
								)
							}}
						</FeedbackBanner>
						<Button v-if="inVideo" @click="props.backToVideo()">{{
							__('Resume Video')
						}}</Button>
					</template>
					<template v-else-if="scheduleBlocked">
						<div
							data-testid="quiz-schedule-blocked"
							class="rounded-6 bg-surface-amber-1 px-4 py-3 text-p-base text-ink-amber-5"
						>
							{{ scheduleMessage }}
						</div>
						<Button v-if="inVideo" @click="props.backToVideo()">{{
							__('Resume Video')
						}}</Button>
					</template>
					<div v-else class="flex flex-wrap items-center justify-between gap-3">
						<span class="text-sm text-ink-gray-6">
							<template v-if="quiz.data.enable_proctoring && !cameraReady">
								{{
									__(
										'Position your face in the camera to enable the start button.'
									)
								}}
							</template>
							<template v-else-if="quiz.data.duration">
								{{ __('The timer starts as soon as you begin.') }}
							</template>
						</span>
						<div class="flex items-center gap-2">
							<Button v-if="inVideo" @click="props.backToVideo()">{{
								__('Resume Video')
							}}</Button>
							<Button
								variant="solid"
								:disabled="!!quiz.data.enable_proctoring && !cameraReady"
								@click="startQuiz"
							>
								{{ __('Start Quiz') }}
							</Button>
						</div>
					</div>

					<div
						v-if="
							quiz.data.enable_proctoring &&
							!attemptsExhausted &&
							!scheduleBlocked
						"
						class="grid gap-4 md:grid-cols-2"
					>
						<div
							class="flex flex-col overflow-hidden rounded-6 border border-outline-gray-2"
						>
							<div class="border-b border-outline-gray-1 px-3.5 py-2.5">
								<div class="text-sm-semibold text-ink-gray-8">
									{{ __('Camera Setup') }}
								</div>
							</div>
							<div class="flex min-h-[18rem] flex-1 flex-col p-3.5 md:min-h-0">
								<ProctoringMonitor
									class="flex min-h-0 flex-1 flex-col"
									:max-violations="quiz.data.max_violations"
									:active="false"
									:violation-count="violationCount"
									@camera-ready="cameraReady = true"
									@camera-lost="cameraReady = false"
									@camera-denied="() => {}"
									@violation="handleViolation"
									@warning="handleWarning"
								/>
							</div>
						</div>

						<div
							class="flex flex-col overflow-hidden rounded-6 border border-outline-gray-2"
						>
							<div class="border-b border-outline-gray-1 px-3.5 py-2.5">
								<div class="text-sm-semibold text-ink-gray-8">
									{{ __('Proctoring Rules') }}
								</div>
							</div>
							<div class="divide-y divide-outline-gray-1">
								<div
									v-for="rule in proctoringRules"
									:key="rule.icon"
									class="flex items-start gap-3 px-3.5 py-3"
								>
									<span
										:class="rule.icon"
										class="mt-0.5 size-4 shrink-0 text-ink-gray-5"
									/>
									<div>
										<div class="text-base text-ink-gray-8">
											{{ rule.title }}
										</div>
										<div class="mt-0.5 text-p-sm text-ink-gray-6">
											{{ rule.hint }}
										</div>
									</div>
								</div>
								<div
									class="flex items-start gap-3 bg-surface-orange-1 px-3.5 py-3"
								>
									<span
										class="lucide-alert-triangle mt-0.5 size-4 shrink-0 text-ink-orange-4"
									/>
									<div class="text-p-base text-ink-orange-5">
										{{
											__(
												'After {0} {1}, the quiz will be automatically submitted.'
											).format(
												quiz.data.max_violations,
												quiz.data.max_violations == 1
													? __('violation')
													: __('violations')
											)
										}}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div v-else-if="!quizSubmission.data">
				<template v-for="(question, qtidx) in questions" :key="question.name">
					<div v-if="qtidx == activeQuestion - 1 && questionDetails.data">
						<div
							class="flex h-11 items-center gap-3 border-b border-outline-gray-1 bg-surface-gray-1 px-3.5"
						>
							<span class="shrink-0 text-sm text-ink-gray-6">
								{{
									__('Question {0} of {1}').format(
										activeQuestion,
										questions.length
									)
								}}
							</span>
							<div
								role="progressbar"
								class="min-w-0 flex-1"
								:aria-label="__('Quiz progress')"
								aria-valuemin="0"
								:aria-valuemax="questions.length"
								:aria-valuenow="activeQuestion"
								:aria-valuetext="
									__('Question {0} of {1}').format(
										activeQuestion,
										questions.length
									)
								"
							>
								<Progress
									size="sm"
									aria-hidden="true"
									:value="(activeQuestion / questions.length) * 100"
								/>
							</div>
							<span class="shrink-0 text-sm text-ink-gray-6">
								{{ question.marks }}
								{{ question.marks == 1 ? __('Mark') : __('Marks') }}
							</span>
						</div>

						<div class="space-y-3 p-3.5">
							<div class="space-y-1">
								<div class="text-sm text-ink-gray-6">
									{{
										questionDetails.data.type == 'Open Ended'
											? __('Written response')
											: getInstructions(questionDetails.data)
									}}
								</div>
								<div
									:id="questionTextId"
									class="text-p-base font-semibold text-ink-gray-9 break-words [&_img]:h-auto [&_img]:max-w-full"
									v-safe-html:rich="questionDetails.data.question"
								></div>
							</div>

							<div
								v-if="questionDetails.data.type == 'Choices'"
								:role="questionDetails.data.multiple ? 'group' : 'radiogroup'"
								:aria-labelledby="questionTextId"
								class="flex flex-col gap-1.5"
							>
								<template v-for="index in MAX_OPTIONS" :key="index">
									<template v-if="questionDetails.data[`option_${index}`]">
										<OptionRow>
											<template #control>
												<input
													:type="
														questionDetails.data.multiple ? 'checkbox' : 'radio'
													"
													:name="`${optionGroup}-${activeQuestion}`"
													class="size-3.5 shrink-0 text-ink-gray-9 focus:ring-outline-elevation-2"
													:class="
														questionDetails.data.multiple
															? 'rounded-1'
															: 'border-outline-gray-4 bg-surface-base checked:border-4 checked:border-[color:var(--ink-gray-9)] checked:bg-surface-base checked:bg-none'
													"
													:disabled="!!showAnswers.length"
													:checked="!!selectedOptions[index - 1]"
													@change="markAnswer(index)"
												/>
											</template>
											<span
												v-safe-html:rich="
													questionDetails.data[`option_${index}`]
												"
											></span>
											<template
												v-if="showAnswers.length && quiz.data.show_answers"
												#end
											>
												<template v-if="showAnswers[index - 1] == 1">
													<span
														class="lucide-check-circle size-4 shrink-0 text-ink-green-4"
														aria-hidden="true"
													/>
													<span class="sr-only">
														{{ __('Your answer, correct') }}
													</span>
												</template>
												<template v-else-if="showAnswers[index - 1] == 2">
													<span
														class="lucide-minus-circle size-4 shrink-0 text-ink-green-4"
														aria-hidden="true"
													/>
													<span class="sr-only">{{
														__('Correct answer')
													}}</span>
												</template>
												<template v-else-if="showAnswers[index - 1] == 0">
													<span
														class="lucide-x-circle size-4 shrink-0 text-ink-red-5"
														aria-hidden="true"
													/>
													<span class="sr-only">
														{{ __('Your answer, incorrect') }}
													</span>
												</template>
											</template>
										</OptionRow>
										<div
											v-if="questionDetails.data[`explanation_${index}`]"
											v-show="showAnswers.length"
											class="break-words px-3 text-p-base text-ink-gray-7"
										>
											{{ questionDetails.data[`explanation_${index}`] }}
										</div>
									</template>
								</template>
								<div role="status" class="empty:absolute">
									<FeedbackBanner
										v-if="showAnswers.length && quiz.data.show_answers"
										data-testid="quiz-feedback"
										:correct="choiceCorrect"
									>
										{{ choiceCorrect ? __('Correct') : __('Incorrect') }}
									</FeedbackBanner>
								</div>
							</div>
							<div
								v-else-if="questionDetails.data.type == 'User Input'"
								class="space-y-3"
							>
								<FormControl
									v-model="possibleAnswer"
									type="textarea"
									:aria-labelledby="questionTextId"
									:disabled="showAnswers.length ? true : false"
								/>
								<div role="status" class="empty:absolute">
									<FeedbackBanner
										v-if="showAnswers.length"
										data-testid="quiz-feedback"
										:correct="!!showAnswers[0]"
									>
										{{ showAnswers[0] ? __('Correct') : __('Incorrect') }}
									</FeedbackBanner>
								</div>
							</div>
							<div v-else>
								<RichTextEditor
									:content="possibleAnswer"
									@change="(val) => (possibleAnswer = val)"
									:editable="true"
									:fixedMenu="true"
									minHeight="7rem"
									:ariaLabelledby="questionTextId"
								/>
							</div>

							<div class="flex flex-wrap items-center gap-4 pt-2">
								<div class="flex-1">
									<Checkbox
										v-if="!quiz.data.show_answers"
										:label="__('Mark for review')"
										:model-value="reviewQuestions.includes(activeQuestion)"
										@update:model-value="
											(checked) => markForReview(!!checked, activeQuestion)
										"
									/>
									<span
										v-else-if="questionDetails.data.type == 'Open Ended'"
										class="text-sm text-ink-gray-6"
									>
										{{ __('Marked by your instructor') }}
									</span>
								</div>
								<div class="flex flex-1 justify-end gap-2">
									<Button
										v-if="!quiz.data.show_answers && activeQuestion > 1"
										@click="switchQuestion(activeQuestion - 1)"
									>
										<span>{{ __('Previous') }}</span>
									</Button>
									<Button
										v-if="
											quiz.data.show_answers &&
											!showAnswers.length &&
											questionDetails.data.type != 'Open Ended'
										"
										variant="solid"
										@click="checkAnswer()"
									>
										<span>{{ __('Check') }}</span>
									</Button>
									<Button
										v-else-if="activeQuestion != questions.length"
										:variant="quiz.data.show_answers ? 'solid' : 'subtle'"
										@click="
											quiz.data.show_answers
												? nextQuestion()
												: switchQuestion(activeQuestion + 1)
										"
									>
										<span>{{ __('Next') }}</span>
									</Button>
									<Button
										v-else-if="!preview"
										variant="solid"
										@click="handleSubmitClick()"
									>
										<span>{{ __('Submit') }}</span>
									</Button>
								</div>
							</div>
						</div>
					</div>
				</template>
			</div>

			<div v-else>
				<div
					v-if="
						quiz.data.enable_proctoring && submissionReason === 'max_violations'
					"
					class="border-b border-outline-red-2 bg-surface-red-2 px-3.5 py-3"
				>
					<div class="mb-1 flex items-center gap-2.5">
						<span class="lucide-shield-x size-4 shrink-0 text-ink-red-5" />
						<span class="text-sm-semibold text-ink-red-6">{{
							__('Maximum violations reached')
						}}</span>
					</div>
					<p class="ps-6.5 text-p-base text-ink-red-5">
						{{
							__(
								'This quiz was submitted automatically because you reached the maximum of {0} {1}. Reach out to your instructor if you need to try again.'
							).format(
								quiz.data.max_violations,
								quiz.data.max_violations == 1
									? __('violation')
									: __('violations')
							)
						}}
					</p>
				</div>
				<div class="space-y-3 p-3.5">
					<h2
						ref="summaryHeading"
						tabindex="-1"
						class="text-base-semibold text-ink-gray-9"
					>
						{{ __('Quiz Summary') }}
					</h2>
					<div
						class="flex items-start gap-2 rounded-6 border border-outline-gray-2 bg-surface-gray-1 p-3"
					>
						<span
							class="lucide-check-circle mt-0.5 size-4 shrink-0 text-ink-gray-6"
						/>
						<p
							v-if="quizSubmission.data.is_open_ended"
							class="text-p-base text-ink-gray-7"
						>
							{{
								__(
									"Your submission has been successfully saved. The instructor will review and grade it shortly, and you'll be notified of your final result."
								)
							}}
						</p>
						<p v-else class="text-p-base text-ink-gray-7">
							{{
								__(
									'You got {0}% correct answers with a score of {1} out of {2}'
								).format(
									Math.ceil(quizSubmission.data.percentage),
									quizSubmission.data.score,
									quizSubmission.data.score_out_of
								)
							}}
						</p>
					</div>
					<div
						v-if="
							!quiz.data.max_attempts ||
							(attempts.data?.length ?? 0) < quiz.data.max_attempts ||
							inVideo
						"
						class="flex items-center justify-end gap-x-2"
					>
						<Button v-if="inVideo" @click="props.backToVideo()">
							{{ __('Resume Video') }}
						</Button>
						<Button
							@click="resetQuiz()"
							v-if="
								!quiz.data.max_attempts ||
								(attempts.data?.length ?? 0) < quiz.data.max_attempts
							"
						>
							<span>
								{{ __('Try Again') }}
							</span>
						</Button>
					</div>
				</div>
			</div>
		</AssessmentCard>

		<div
			v-if="
				activeQuestion > 0 && quiz.data.enable_proctoring && summaryLog.length
			"
			class="overflow-hidden rounded-6 border border-outline-gray-2"
		>
			<div
				class="flex items-center justify-between border-b border-outline-gray-1 bg-surface-gray-1 px-3.5 py-2.5"
			>
				<span class="text-xs font-semibold text-ink-gray-8">{{
					__('Activity')
				}}</span>
				<span class="text-xs text-ink-gray-6"
					>{{ summaryLog.length }}
					{{ summaryLog.length == 1 ? __('event') : __('events') }}</span
				>
			</div>
			<div class="max-h-64 divide-y divide-outline-gray-1 overflow-y-auto">
				<div
					v-for="(entry, i) in summaryLog"
					:key="i"
					class="flex items-center gap-2.5 px-3.5 py-2.5"
				>
					<span
						class="size-1.5 shrink-0 rounded-full"
						:class="
							entry.severity === 'violation'
								? 'bg-surface-red-6'
								: 'bg-surface-orange-6'
						"
					/>
					<span class="flex-1 text-sm text-ink-gray-7">{{
						violationEventLabels[entry.eventType] || entry.eventType
					}}</span>
					<a
						v-if="safeUrl(entry.frame)"
						v-external
						:href="safeUrl(entry.frame)"
						class="shrink-0"
					>
						<img
							:src="safeUrl(entry.frame)"
							:alt="
								__('Camera at {0}').format(
									violationEventLabels[entry.eventType] || entry.eventType
								)
							"
							class="h-8 w-11 rounded-4 border object-cover"
						/>
					</a>
					<span
						class="shrink-0 text-xs font-medium uppercase tracking-wide"
						:class="
							entry.severity === 'violation'
								? 'text-ink-red-5'
								: 'text-ink-orange-5'
						"
					>
						{{
							entry.severity === 'violation' ? __('Violation') : __('Warning')
						}}
					</span>
				</div>
			</div>
		</div>

		<div
			v-if="
				activeQuestion > 0 && !quizSubmission.data && !quiz.data.show_answers
			"
			class="rounded-6 border border-outline-gray-2 p-3.5"
		>
			<div class="text-sm-semibold text-ink-gray-9">
				{{ __('Questions') }}
			</div>
			<nav
				:aria-label="__('Question navigation')"
				class="mt-2 flex flex-wrap items-center gap-2"
			>
				<button
					v-for="index in questions.length"
					:key="index"
					type="button"
					:aria-label="
						(attemptedQuestions.includes(index)
							? __('Question {0}, answered')
							: __('Question {0}, not answered')
						).format(index)
					"
					:aria-current="activeQuestion == index ? 'step' : undefined"
					@click="switchQuestion(index)"
					class="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-sm"
					:class="{
						'bg-surface-gray-7 text-ink-base font-medium':
							activeQuestion == index,
						'bg-surface-blue-2 text-ink-blue-5':
							activeQuestion != index && attemptedQuestions.includes(index),
						'bg-surface-gray-3':
							activeQuestion != index && !attemptedQuestions.includes(index),
					}"
				>
					{{ index }}
					<CircleCheck
						v-if="attemptedQuestions.includes(index)"
						class="absolute -top-1.5 -end-1.5 size-4 stroke-1.5 shrink-0 rounded-full bg-surface-base text-ink-green-8 fill-none"
						aria-hidden="true"
					/>
				</button>
			</nav>
		</div>

		<div
			v-if="
				activeQuestion > 0 && !quizSubmission.data && reviewQuestions.length
			"
			class="rounded-6 border border-outline-gray-2 p-3.5"
		>
			<div class="text-sm-semibold text-ink-gray-9">
				{{ __('Questions marked for review') }}
			</div>
			<div class="mt-2 flex flex-wrap items-center gap-2">
				<button
					v-for="index in reviewQuestions"
					:key="index"
					type="button"
					@click="switchQuestion(index)"
					class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-surface-gray-3 text-sm"
				>
					{{ index }}
				</button>
			</div>
		</div>

		<div
			v-if="
				quiz.data.show_submission_history &&
				attempts?.data &&
				attempts.data.length > 0
			"
			class="mt-10"
		>
			<ResponsiveListView
				:columns="getSubmissionColumns()"
				:rows="attempts.data ?? []"
				row-key="name"
				title-key="creation"
				:options="getSubmissionOptions()"
			/>
		</div>
	</div>
	<Dialog
		v-model:open="showSubmissionConfirmation"
		:title="__('Are you sure you want to submit the quiz?')"
		:actions="[
			{
				size: 'sm',
				label: __('Submit'),
				variant: 'solid',
				onClick() {
					submitQuiz()
					showSubmissionConfirmation = false
				},
			},
		]"
	>
		<template #default>
			<div class="space-y-3">
				<p
					v-if="questions.length - attemptedQuestions.length > 0"
					class="text-base text-ink-gray-6 leading-5"
				>
					{{
						__(
							'You have {0} unattempted {1}. They will be marked incorrect if you submit.'
						).format(
							questions.length - attemptedQuestions.length,
							questions.length - attemptedQuestions.length == 1
								? __('question')
								: __('questions')
						)
					}}
				</p>
				<p v-else class="text-base text-ink-gray-6 leading-5">
					{{ __('All questions have been attempted.') }}
				</p>
				<div class="space-y-1.5">
					<div
						class="flex h-2.5 rounded-full overflow-hidden bg-surface-gray-3"
					>
						<div
							class="h-full rounded-full transition-all"
							:class="
								attemptedQuestions.length === questions.length
									? 'bg-surface-green-7'
									: 'bg-surface-green-7'
							"
							:style="{
								width:
									(attemptedQuestions.length / questions.length) * 100 + '%',
							}"
						/>
					</div>
					<div class="flex justify-between text-xs">
						<span class="text-ink-green-6 font-medium"
							>{{ attemptedQuestions.length }} {{ __('attempted') }}</span
						>
						<span
							:class="
								questions.length - attemptedQuestions.length > 0
									? 'text-ink-orange-6 font-medium'
									: 'text-ink-gray-6'
							"
						>
							{{ questions.length - attemptedQuestions.length }}
							{{ __('unattempted') }}
						</span>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Badge,
	Button,
	Checkbox,
	createResource,
	Dialog,
	FormControl,
	Progress,
	Skeleton,
	toast,
} from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { CircleCheck } from 'lucide-vue-next'
import {
	computed,
	inject,
	nextTick,
	onMounted,
	onUnmounted,
	reactive,
	ref,
	useId,
	watch,
} from 'vue'
import { timeAgo } from '@/utils/format'
import { safeUrl } from '@/utils/safeUrl'
import {
	formatScheduleDate,
	useAssessmentSchedule,
} from '@/composables/useAssessmentSchedule'
import { markLessonProgress } from '@/utils/markLessonProgress'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import ProctoringMonitor from '@/components/ProctoringMonitor.vue'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'
import OptionRow from '@/components/Assessment/OptionRow.vue'
import FeedbackBanner from '@/components/Assessment/FeedbackBanner.vue'
import QuizStats from '@/components/Assessment/QuizStats.vue'
import { attemptsLeftLabel, formatQuizSubtitle } from '@/utils/quizSummary'
import type {
	AnswerVerdict,
	QuizAttempt,
	QuizDetails,
	QuizQuestionDetails,
	QuizQuestionRow,
	QuizSubmissionResult,
	QuizWithQuestions,
	SavedAnswer,
	SessionUser,
	StoredViolationRow,
	ViolationEvent,
} from '@/types'

type Answer = string | null | undefined
type SubmissionReason =
	| 'manual'
	| 'timer_expired'
	| 'max_violations'
	| 'browser_closed'

const user = inject<SessionUser>('$user')!
const activeQuestion = ref(0)
const currentQuestion = ref('')
const MAX_OPTIONS = 10
const selectedOptions = ref<number[]>(Array(MAX_OPTIONS).fill(0))

const showAnswers = reactive<AnswerVerdict[]>([])
const questions = ref<QuizQuestionRow[]>([])
const attemptedQuestions = ref<number[]>([])
const reviewQuestions = ref<number[]>([])
const showSubmissionConfirmation = ref(false)
const possibleAnswer = ref<string | null>(null)
const timer = ref(0)
let timerInterval: ReturnType<typeof setInterval> | undefined
const violationCount = ref(0)
const proctoringActive = ref(false)
const cameraReady = ref(false)
const violationLog = ref<ViolationEvent[]>([])
const submissionReason = ref<SubmissionReason | ''>('')
let submitTimeout: ReturnType<typeof setTimeout> | undefined

const props = withDefaults(
	defineProps<{
		quizName: string
		// Author preview: rendered as shipped, but writes nothing. A submission
		// here would be real, notify, and spend one of the author's attempts.
		preview?: boolean
		inVideo?: boolean
		backToVideo?: () => void
	}>(),
	{
		preview: false,
		inVideo: false,
		backToVideo: () => {},
	}
)

onMounted(() => {
	window.addEventListener('pagehide', handlePageHide)
	window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
	window.removeEventListener('pagehide', handlePageHide)
	window.removeEventListener('beforeunload', handleBeforeUnload)
	stopTimer()
})

// Oldest first. violationLog is built newest-first for the on-screen activity
// list, but the server derives the stored violation count from this payload, so
// it ships in the order the events actually happened.
// withFrames=false for the pagehide beacon: that goes out as a query string, and a
// handful of base64 stills would push it past the URL limit and drop the log
// entirely. The events matter more there than the pictures of them.
const serialiseViolationLog = (withFrames = true): string =>
	JSON.stringify(
		[...violationLog.value]
			.reverse()
			.map(({ frame, ...event }) => (withFrames ? { ...event, frame } : event))
	)

const handlePageHide = (): void => {
	if (props.preview) return
	if (activeQuestion.value > 0 && !quizSubmission.data && quiz.data) {
		const params = new URLSearchParams({
			quiz: quiz.data.name,
			results: localStorage.getItem(quiz.data.title) || '[]',
			violation_count: String(violationCount.value),
			submission_reason: 'browser_closed',
		})
		// Beacons go out as a query string, so only spend the URL budget on the
		// log when there is one.
		if (violationLog.value.length) {
			params.set('violation_events', serialiseViolationLog(false))
		}

		navigator.sendBeacon(
			'/api/method/lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz?' +
				params.toString()
		)
	}
}

const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
	if (activeQuestion.value > 0 && !quizSubmission.data) {
		recordCurrentAttempt()
		event.preventDefault()
		event.returnValue = ''
	}
}

// Quiz doc + every question's content in one round trip. The lesson-side
// quiz used to fetch the quiz, then fire one get_question_details per
// question as the learner advanced. Pulling them all up front lets the
// activeQuestion watcher read from a local map instead of round-tripping.
const questionsByName = ref<Record<string, QuizQuestionDetails>>({})
// Native radios group by name across the page, and a lesson can show two quizzes.
const optionGroup = useId()
const questionTextId = useId()
const summaryHeading = ref<HTMLElement | null>(null)

const quiz = createResource<QuizDetails>({
	url: 'lms.lms.utils.get_quiz_with_questions',
	makeParams() {
		return { quiz: props.quizName }
	},
	// Keep this resource instance-local: its callbacks update component-local
	// question and timer state on every mount.
	auto: true,
	transform(data: QuizWithQuestions) {
		const quizDoc = data?.quiz || ({} as QuizDetails)
		quizDoc.duration = parseInt(String(quizDoc.duration))
		questionsByName.value = data?.questions_by_name || {}
		return quizDoc
	},
	onSuccess() {
		populateQuestions()
		setupTimer()
	},
})

const populateQuestions = () => {
	const data = quiz.data
	const rawQuestions = Array.isArray(data?.questions) ? data.questions : []
	// Drop rows whose linked question no longer resolves (e.g. the question
	// was deleted while still referenced by the quiz). Keeping a phantom row
	// lets questionDetails.data go null mid-quiz and crash getAnswers and the
	// unload handlers, which, since the quiz now mounts inline in the lesson,
	// blanks the whole lesson view.
	const resolvable = rawQuestions.filter(
		(row: QuizQuestionRow) =>
			row?.question && questionsByName.value[row.question]
	)
	if (data?.shuffle_questions) {
		let next = shuffleArray([...resolvable])
		if (data.limit_questions_to) {
			next = next.slice(0, data.limit_questions_to)
		}
		questions.value = next
	} else {
		questions.value = resolvable
	}
}

const setupTimer = () => {
	// resetQuiz() reaches here from the quizName watcher, which fires before the
	// new quiz has loaded — and on the very first navigation quiz.data is still
	// null. Throwing here would abort the watcher before it can reload.
	if (quiz.data?.duration) {
		timer.value = quiz.data.duration * 60
	}
}

const stopTimer = () => {
	clearInterval(timerInterval)
	timerInterval = undefined
	// submitQuiz() defers createSubmission() by 500ms so the last answer can be
	// written to localStorage first. Left pending, it fires against an unmounted
	// or already-switched component and marks progress on the wrong lesson.
	clearTimeout(submitTimeout)
	submitTimeout = undefined
}

const startTimer = () => {
	// The same instance can start a quiz more than once — a retake, or the
	// component reused for another quiz. Without this, each start leaves the
	// previous interval running and every one of them submits on expiry.
	stopTimer()
	timerInterval = setInterval(() => {
		timer.value--
		if (timer.value == 0) {
			clearInterval(timerInterval)
			stopTimer()
			submitQuiz('timer_expired')
		}
	}, 1000)
}

const formatTimer = (seconds: number): string => {
	const hrs = Math.floor(seconds / 3600)
		.toString()
		.padStart(2, '0')
	const mins = Math.floor((seconds % 3600) / 60)
		.toString()
		.padStart(2, '0')
	const secs = (seconds % 60).toString().padStart(2, '0')
	return hrs != '00' ? `${hrs}:${mins}:${secs}` : `${mins}:${secs}`
}

const timerUrgency = computed(() => {
	if (!quiz.data?.duration) return 'normal'
	const pct = timer.value / (quiz.data.duration * 60)
	if (pct <= 0.1) return 'critical'
	if (pct <= 0.25) return 'warning'
	return 'normal'
})

// frappe-ui 1.0 has no orange Badge theme; amber is the warning tone.
const timerTheme = computed<'red' | 'amber' | 'gray'>(() => {
	if (timerUrgency.value === 'critical') return 'red'
	if (timerUrgency.value === 'warning') return 'amber'
	return 'gray'
})

const attemptsLeft = computed(() => {
	if (!quiz.data?.max_attempts) return null
	return Math.max(quiz.data.max_attempts - (attempts.data?.length ?? 0), 0)
})

const quizSubtitle = computed(() =>
	formatQuizSubtitle(
		questions.value.map((row) => questionsByName.value[row.question]?.type),
		quiz.data?.passing_percentage
	)
)

const introTips = computed(() => {
	if (!quiz.data) return []
	const proctored = quiz.data.enable_proctoring
	const tips: string[] = []
	if (props.inVideo) tips.push(__('Complete the quiz to continue the video.'))
	if (!proctored) {
		tips.push(
			__(
				'Use "Mark for Review" to flag questions you want to revisit before submitting.'
			),
			__(
				'Answer all questions before you submit. You can navigate freely between them.'
			)
		)
	}
	tips.push(
		__('Closing or refreshing the page will submit your quiz automatically.')
	)
	if (!proctored && quiz.data.duration) {
		tips.push(
			__('The quiz will be submitted automatically when the timer runs out.')
		)
	}
	if (quiz.data.enable_negative_marking) {
		tips.push(
			__('Wrong answers deduct {0} {1}.').format(
				quiz.data.marks_to_cut,
				quiz.data.marks_to_cut == 1 ? __('mark') : __('marks')
			)
		)
	}
	return tips
})

const proctoringRules = computed(() => [
	{
		icon: 'lucide-eye-off',
		title: __('Face must be visible'),
		hint: __('Looking away for too long counts as a violation.'),
	},
	{
		icon: 'lucide-users',
		title: __('One person only'),
		hint: __('Multiple faces in the frame will be flagged.'),
	},
	{
		icon: 'lucide-monitor-x',
		title: __('Stay on this tab'),
		hint: __('Switching tabs or minimizing the window is flagged immediately.'),
	},
	{
		icon: 'lucide-camera-off',
		title: __('Keep camera connected'),
		hint: __('Disconnecting your camera counts as a violation.'),
	},
])

const choiceCorrect = computed(
	() => !showAnswers.some((answer) => answer == 0 || answer == 2)
)

const attemptsExhausted = computed(
	() =>
		!!quiz.data?.max_attempts &&
		(attempts.data?.length ?? 0) >= quiz.data.max_attempts
)

const { scheduleBlockReason, scheduleBlocked, scheduleMessage } =
	useAssessmentSchedule(() => quiz.data, {
		opensOn: (date) => __('This quiz opens on {0}.').format(date),
		ended: () => __('The schedule for this quiz has ended.'),
	})

watch(scheduleBlockReason, (reason, previous) => {
	// Questions are withheld while blocked; once the window opens, refetch so
	// Start can load real prompts without a full page reload.
	if (previous && !reason && !Object.keys(questionsByName.value).length) {
		quiz.reload()
	}
})

const shuffleArray = <T>(array: T[]): T[] => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
	return array
}

const attempts = createResource<QuizAttempt[]>({
	url: 'frappe.client.get_list',
	makeParams() {
		return {
			doctype: 'LMS Quiz Submission',
			filters: {
				member: user.data?.name,
				quiz: quiz.data?.name,
			},
			fields: [
				'name',
				'creation',
				'score',
				'score_out_of',
				'percentage',
				'passing_percentage',
			],
			order_by: 'creation desc',
		}
	},
	transform(data: QuizAttempt[]) {
		data.forEach((submission, index) => {
			submission.creation = timeAgo(submission.creation)
			submission.idx = index + 1
		})
	},
})

watch(
	() => quiz.data,
	() => {
		if (quiz.data) {
			populateQuestions()
		}
		if (quiz.data && quiz.data.max_attempts) {
			attempts.reload()
			resetQuiz()
		}
	}
)

const quizSubmission = createResource<QuizSubmissionResult>({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz',
	makeParams(values?: {
		violation_count?: number
		submission_reason?: SubmissionReason
	}) {
		return {
			quiz: quiz.data?.name,
			results: localStorage.getItem(quiz.data?.title ?? '') || '[]',
			violation_count: values?.violation_count ?? violationCount.value,
			submission_reason: values?.submission_reason ?? 'manual',
			violation_events: serialiseViolationLog(),
		}
	},
})

// Mirror the previous createResource shape ({ data: ... }) so existing
// template refs (questionDetails.data.option_X, etc.) keep working. We
// just pull the row from the pre-fetched map instead of an API call.
const questionDetails = reactive<{ data: QuizQuestionDetails | null }>({
	data: null,
})

watch(activeQuestion, (value) => {
	if (value <= 0) return
	// Read from the local `questions` array. That's the shuffled / limited
	// copy populateQuestions built. `quiz.data.questions` is the raw,
	// un-shuffled list and can be a different length when limit_questions_to
	// is set.
	const row = questions.value[value - 1]
	if (!row?.question) return
	currentQuestion.value = row.question
	questionDetails.data = questionsByName.value[currentQuestion.value] || null
	if (!quiz.data?.show_answers) {
		loadSavedAnswers()
	}
})

const switchQuestion = (questionNumber: number): void => {
	const answers = getAnswers()
	if (answers.length) {
		if (!attemptedQuestions.value.includes(activeQuestion.value)) {
			attemptedQuestions.value.push(activeQuestion.value)
		}
		addToLocalStorage()
		resetQuestion()
	}

	if (questionNumber < 1 || questionNumber > questions.value.length) return
	activeQuestion.value = questionNumber
}

const readSavedAnswers = (): SavedAnswer[] | null =>
	JSON.parse(localStorage.getItem(quiz.data?.title ?? '') ?? 'null')

const loadSavedAnswers = (): void => {
	const details = questionDetails.data
	const quizData = readSavedAnswers()
	if (quizData && details) {
		const localQuestion = quizData.find(
			(q) => q.question_name == currentQuestion.value
		)
		if (localQuestion) {
			const localAnswers = localQuestion.answer
			if (localAnswers.length) {
				if (details.type == 'Choices') {
					localAnswers.forEach((answer) => {
						for (let i = 1; i <= MAX_OPTIONS; i++) {
							if (details[`option_${i}`] == answer) {
								selectedOptions.value[i - 1] = 1
							}
						}
					})
				} else {
					possibleAnswer.value = localAnswers[0] ?? null
				}
			}
		}
	}
}

watch(
	() => props.quizName,
	(newName) => {
		if (newName) {
			// The lesson-level quiz is not keyed at its mount site, so moving
			// between two lessons that both carry a quiz reuses this instance
			// instead of remounting it. Reloading alone leaves the previous
			// quiz's answers, flagged questions and submission on screen.
			stopTimer()
			resetQuiz()
			// Only on a genuine quiz switch, never from resetQuiz() itself — that is
			// also the "Try Again" handler, and nulling attempts there leaves the
			// start card with neither a Start button nor the exceeded-attempts
			// message, both of which read attempts.data?.length.
			attempts.reset()
			// A submission already in flight is NOT aborted: the POST has reached the
			// server and the attempt is spent either way, so cancelling the client
			// would only hide the result. It is ignored instead, by submittedQuiz.
			quiz.reload()
		}
	}
)

const startQuiz = () => {
	if (scheduleBlocked.value) return
	if (!quiz.data) return
	activeQuestion.value = 1
	localStorage.removeItem(quiz.data.title)
	// Neither in an author preview. Nothing may be submitted there, so a countdown
	// would reach zero with no way to end the attempt and the camera would stay on
	// with it, and a violation cap would do the same.
	if (props.preview) return
	if (quiz.data.duration) startTimer()
	if (quiz.data.enable_proctoring) proctoringActive.value = true
}

// The stored log, read back after submitting. It is the same rows an instructor
// sees, and unlike the client's own list it carries the camera stills as file URLs
// rather than data: URIs.
const storedViolationLog = createResource<StoredViolationRow[]>({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.get_quiz_violation_logs',
	makeParams() {
		return { submission: quizSubmission.data?.submission }
	},
})

// The summary replaces the question in place, so move focus onto it or a
// screen reader user is left on a control that no longer exists. Only after a
// submit here: a result that just loads should not pull focus.
watch(
	() => quizSubmission.data,
	async (submission) => {
		if (!submission || !submissionReason.value) return
		await nextTick()
		summaryHeading.value?.focus()
	}
)

watch(
	() => quizSubmission.data?.submission,
	(submission) => {
		if (submission) storedViolationLog.fetch()
	}
)

// Prefer the stored log once it lands. Before that — and during the quiz itself,
// where there is no submission to read — the client's own list stands in, so the
// activity table is never empty while events are happening.
const summaryLog = computed<ViolationEvent[]>(() =>
	storedViolationLog.data?.length
		? storedViolationLog.data.map((row: StoredViolationRow) => ({
				eventType: row.event_type,
				severity: row.severity,
				timestamp: row.timestamp,
				frame: row.frame,
		  }))
		: violationLog.value
)

const violationEventLabels: Record<string, string> = {
	tab_switch: __('Tab switch'),
	no_face: __('Face not visible'),
	multiple_faces: __('Multiple faces'),
	focus_loss: __('Window focus lost'),
	camera_disconnect: __('Camera disconnected'),
}

const handleViolation = (
	eventType: string,
	frame: string | null = null
): void => {
	if (submissionReason.value || quizSubmission.loading || quizSubmission.data)
		return
	violationCount.value++
	violationLog.value.unshift({
		eventType,
		severity: 'violation',
		timestamp: new Date().toISOString(),
		frame,
	})
	const remaining = (quiz.data?.max_violations ?? 0) - violationCount.value
	if (remaining <= 0) {
		submitQuiz('max_violations')
	} else {
		const label = violationEventLabels[eventType] || __('Proctoring violation')
		toast.warning(label + '. ' + __('Remaining: {0}').format(remaining))
	}
}

const handleWarning = (
	eventType: string,
	frame: string | null = null
): void => {
	// Deduplicate consecutive warnings of the same type
	if (
		violationLog.value[0]?.eventType === eventType &&
		violationLog.value[0]?.severity === 'warning'
	)
		return
	violationLog.value.unshift({
		eventType,
		severity: 'warning',
		timestamp: new Date().toISOString(),
		frame,
	})
}

const markAnswer = (index: number): void => {
	if (!questionDetails.data?.multiple)
		selectedOptions.value.splice(
			0,
			selectedOptions.value.length,
			...Array(MAX_OPTIONS).fill(0)
		)
	selectedOptions.value[index - 1] = selectedOptions.value[index - 1] ? 0 : 1
}

const getAnswers = (): Answer[] => {
	const answers: Answer[] = []
	const details = questionDetails.data
	if (!details) return answers
	if (details.type == 'Choices') {
		selectedOptions.value.forEach((value, index) => {
			if (value) answers.push(details[`option_${index + 1}`])
		})
	} else {
		answers.push(possibleAnswer.value)
	}

	return answers
}

const checkAnswer = (): void => {
	const answers = getAnswers()
	const details = questionDetails.data
	if (!quiz.data || !details) return
	if (!answers.length) {
		toast.warning(__('Please select an option'))
		return
	}

	createResource({
		url: 'lms.lms.doctype.lms_quiz.lms_quiz.check_answer',
		params: {
			quiz: quiz.data.name,
			question: currentQuestion.value,
			question_type: details.type,
			answers: JSON.stringify(answers),
		},
		auto: true,
		onSuccess(data: AnswerVerdict[] | AnswerVerdict) {
			if (details.type == 'Choices' && Array.isArray(data)) {
				selectedOptions.value.forEach((option, index) => {
					if (option) {
						showAnswers[index] = data[index]
					} else if (data[index] == 2) {
						showAnswers[index] = 2
					} else {
						showAnswers[index] = undefined
					}
				})
			} else if (!Array.isArray(data)) {
				showAnswers.push(data)
			}
			addToLocalStorage()
			if (!quiz.data?.show_answers) {
				resetQuestion()
			}
		},
	})
}

const addToLocalStorage = (): void => {
	if (!quiz.data) return
	let quizData = readSavedAnswers()
	const questionData: SavedAnswer = {
		question_name: currentQuestion.value,
		answer: getAnswers(),
	}
	if (quizData) {
		const existingQuestion = quizData.find(
			(q) => q.question_name == questionData.question_name
		)
		if (existingQuestion) {
			existingQuestion.answer = questionData.answer
		} else {
			quizData.push(questionData)
		}
	} else {
		quizData = [questionData]
	}
	localStorage.setItem(quiz.data.title, JSON.stringify(quizData))
}

const nextQuestion = (): void => {
	if (!quiz.data?.show_answers) return
	if (questionDetails.data?.type == 'Open Ended') addToLocalStorage()
	resetQuestion()
}

const resetQuestion = () => {
	// Compare against the local `questions` array. `quiz.data.questions` is
	// the raw list and can be longer than what populateQuestions trimmed via
	// limit_questions_to.
	if (activeQuestion.value == questions.value.length) return
	activeQuestion.value = activeQuestion.value + 1
	selectedOptions.value.splice(
		0,
		selectedOptions.value.length,
		...Array(MAX_OPTIONS).fill(0)
	)
	showAnswers.length = 0
	possibleAnswer.value = null
}

const submitQuiz = (reason: SubmissionReason = 'manual'): void => {
	submissionReason.value = reason
	if (!quiz.data?.show_answers) {
		if (questionDetails.data?.type == 'Open Ended' || getAnswers().length) {
			addToLocalStorage()
		}
		submitTimeout = setTimeout(() => {
			submitTimeout = undefined
			createSubmission(reason)
		}, 500)
		return
	}
	createSubmission(reason)
}

const createSubmission = (reason: SubmissionReason = 'manual'): void => {
	if (props.preview) return
	// Which quiz this submission belongs to. The component is reused across
	// lessons, so by the time the response lands props.quizName may have moved
	// on — and markLessonProgress() reads window.location.pathname at that
	// moment, which would credit whatever lesson is open by then.
	const submittedQuiz = props.quizName
	quizSubmission.submit(
		{
			violation_count: violationCount.value,
			submission_reason: reason,
		},
		{
			onSuccess() {
				proctoringActive.value = false
				if (props.quizName !== submittedQuiz) return
				markLessonProgress()
				if (quiz.data && quiz.data.max_attempts) attempts.reload()
				stopTimer()
			},
			onError(err: FrappeResourceError) {
				const errorTitle = err?.message || ''
				if (errorTitle.includes('MaximumAttemptsExceededError')) {
					const errorMessage = err.messages?.[0] || err.message
					toast.error(__(errorMessage))
					setTimeout(() => {
						window.location.reload()
					}, 3000)
				} else {
					// Never re-submit automatically here. A failure can land after the
					// server already created the submission — or its response can simply
					// be lost — and a second POST would spend another attempt and record
					// a duplicate. Saving the violation log is best effort on the server,
					// so it can no longer be the thing that fails a submission; anything
					// reaching this branch is worth showing to the learner instead.
					toast.error(
						__(
							err?.messages?.[0] ||
								'Could not submit the quiz. Please try again.'
						)
					)
				}
			},
		}
	)
}

const resetQuiz = () => {
	activeQuestion.value = 0
	selectedOptions.value.splice(
		0,
		selectedOptions.value.length,
		...Array(MAX_OPTIONS).fill(0)
	)
	showAnswers.length = 0
	possibleAnswer.value = null
	attemptedQuestions.value = []
	reviewQuestions.value = []
	quizSubmission.reset()
	violationCount.value = 0
	proctoringActive.value = false
	cameraReady.value = false
	violationLog.value = []
	submissionReason.value = ''
	populateQuestions()
	setupTimer()
}

const getInstructions = (question: QuizQuestionDetails): string => {
	if (question.type == 'Choices')
		if (question.multiple) return __('Choose all answers that apply')
		else return __('Choose one answer')
	else return __('Type your answer')
}

const handleSubmitClick = (): void => {
	if (!quiz.data?.show_answers) {
		recordCurrentAttempt()
		showSubmissionConfirmation.value = true
	} else {
		submitQuiz()
	}
}

const recordCurrentAttempt = () => {
	if (!getAnswers().length) return
	if (!attemptedQuestions.value.includes(activeQuestion.value)) {
		attemptedQuestions.value.push(activeQuestion.value)
	}
	addToLocalStorage()
}

const markForReview = (checked: boolean, questionNumber: number): void => {
	if (checked) {
		if (!reviewQuestions.value.includes(questionNumber)) {
			reviewQuestions.value.push(questionNumber)
		}
	} else {
		reviewQuestions.value = reviewQuestions.value.filter(
			(num) => num !== questionNumber
		)
	}
}

const getSubmissionColumns = () => {
	return [
		{
			label: 'No.',
			key: 'idx',
			width: 1,
		},
		{
			label: 'Date',
			key: 'creation',
			width: 2,
		},
		{
			label: 'Score',
			key: 'score',
			align: 'left',
			width: 1,
		},
		{
			label: 'Score out of',
			key: 'score_out_of',
			align: 'left',
			width: 1,
		},
		{
			label: 'Percentage',
			key: 'percentage',
			align: 'left',
			width: 1,
		},
	]
}

const getSubmissionOptions = () => {
	return {
		selectable: false,
		showTooltip: false,
		emptyState: { title: __('No Quiz submissions found') },
	}
}
</script>
