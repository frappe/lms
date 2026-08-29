<template>
	<div
		v-if="quiz.loading && !quiz.data"
		class="flex items-center justify-center py-12"
	>
		<LoadingIndicator class="size-4 text-ink-gray-5" />
	</div>
	<div v-else-if="quiz.data">
		<!-- Status bar: timer + violation pill -->
		<div
			v-if="
				activeQuestion > 0 &&
				!quizSubmission.data &&
				(quiz.data.duration || quiz.data.enable_proctoring)
			"
			class="flex items-center justify-between mb-4"
		>
			<!-- Timer pill -->
			<div
				v-if="quiz.data.duration"
				class="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors"
				:class="{
					'bg-surface-red-1 text-ink-red-6': timerUrgency === 'critical',
					'bg-surface-orange-1 text-ink-orange-6': timerUrgency === 'warning',
					'bg-surface-gray-3 text-ink-gray-7': timerUrgency === 'normal',
				}"
			>
				<span class="lucide-timer size-4" />
				{{ formatTimer(timer) }}
			</div>
			<div v-else />

			<!-- Violation pill -->
			<ProctoringMonitor
				v-if="quiz.data.enable_proctoring"
				:max-violations="quiz.data.max_violations"
				:active="proctoringActive"
				:violation-count="violationCount"
				@violation="handleViolation"
				@warning="handleWarning"
				@camera-ready="() => {}"
				@camera-denied="() => {}"
			/>
		</div>

		<div v-if="activeQuestion == 0" class="space-y-4">
			<!-- Info card — full width -->
			<div class="border rounded-xl overflow-hidden">
				<div class="px-5 pt-5 pb-4 space-y-3 text-center">
					<h2 class="text-xl font-semibold text-ink-gray-9 leading-snug">
						{{ quiz.data.title }}
					</h2>
					<div class="flex flex-wrap gap-1.5 justify-center">
						<span
							class="inline-flex items-center gap-1.5 bg-surface-gray-3 text-ink-gray-7 text-xs font-medium px-2.5 py-1 rounded-full"
						>
							<span class="lucide-list size-3.5" />
							{{ questions.length }}
							{{ questions.length == 1 ? __('question') : __('questions') }}
						</span>
						<span
							v-if="quiz.data.passing_percentage"
							class="inline-flex items-center gap-1.5 bg-surface-gray-3 text-ink-gray-7 text-xs font-medium px-2.5 py-1 rounded-full"
						>
							<span class="lucide-target size-3.5" />
							{{
								__('Passing score: {0}%').format(quiz.data.passing_percentage)
							}}
						</span>
						<span
							v-if="quiz.data.max_attempts"
							class="inline-flex items-center gap-1.5 bg-surface-gray-3 text-ink-gray-7 text-xs font-medium px-2.5 py-1 rounded-full"
						>
							<span class="lucide-refresh-cw size-3.5" />
							{{ quiz.data.max_attempts }}
							{{ quiz.data.max_attempts == 1 ? __('attempt') : __('attempts') }}
						</span>
						<span
							v-if="quiz.data.duration"
							class="inline-flex items-center gap-1.5 bg-surface-blue-1 text-ink-blue-6 text-xs font-medium px-2.5 py-1 rounded-full"
						>
							<span class="lucide-timer size-3.5" />
							{{ quiz.data.duration }} {{ __('min') }}
						</span>
						<span
							v-if="quiz.data.enable_proctoring"
							class="inline-flex items-center gap-1.5 bg-surface-orange-1 text-ink-orange-6 text-xs font-medium px-2.5 py-1 rounded-full"
						>
							<span class="lucide-camera size-3.5" />
							{{ __('Proctored') }}
						</span>
					</div>
				</div>

				<!-- Proctored: centered info lines -->
				<div
					v-if="quiz.data.enable_proctoring && questions.length"
					class="px-5 mb-4 space-y-2"
				>
					<div
						v-if="inVideo"
						class="flex items-center justify-center gap-2 text-sm text-ink-gray-6"
					>
						<span class="lucide-play-circle size-4 shrink-0 text-ink-gray-5" />
						{{ __('Complete the quiz to continue the video.') }}
					</div>
					<!-- The icon rides in the text flow rather than in a flex row: on one
					     line it sits centred in that line box, and when the text wraps it
					     stays on the first line instead of centring against both. -->
					<div class="flex justify-center">
						<p class="text-sm text-ink-gray-6">
							<span
								class="lucide-alert-circle me-1 inline-block size-4 align-middle text-ink-gray-5"
								aria-hidden="true"
							/>
							{{
								__(
									'Closing or refreshing the page will submit your quiz automatically.'
								)
							}}
						</p>
					</div>
					<div
						v-if="quiz.data.enable_negative_marking"
						class="flex justify-center"
					>
						<p class="text-sm text-ink-gray-6">
							<span
								class="lucide-minus-circle me-1 inline-block size-4 align-middle text-ink-gray-5"
								aria-hidden="true"
							/>
							{{
								__('Wrong answers deduct {0} {1}.').format(
									quiz.data.marks_to_cut,
									quiz.data.marks_to_cut == 1 ? __('mark') : __('marks')
								)
							}}
						</p>
					</div>
				</div>

				<!-- Non-proctored: tips rows folded into the card -->
				<div
					v-if="
						!quiz.data.enable_proctoring &&
						questions.length &&
						!attemptsExhausted
					"
					class="border-t divide-y"
				>
					<div v-if="inVideo" class="flex items-center gap-3 px-4 py-3">
						<span class="lucide-play-circle size-4 shrink-0 text-ink-gray-5" />
						<div class="text-sm text-ink-gray-7">
							{{ __('Complete the quiz to continue the video.') }}
						</div>
					</div>
					<div class="flex items-start gap-3 px-4 py-3">
						<span
							class="lucide-bookmark size-4 shrink-0 text-ink-gray-5 mt-0.5"
						/>
						<div class="text-sm text-ink-gray-7">
							{{
								__(
									'Use "Mark for Review" to flag questions you want to revisit before submitting.'
								)
							}}
						</div>
					</div>
					<div class="flex items-start gap-3 px-4 py-3">
						<span class="lucide-send size-4 shrink-0 text-ink-gray-5 mt-0.5" />
						<div class="text-sm text-ink-gray-7">
							{{
								__(
									'Answer all questions before you submit. You can navigate freely between them.'
								)
							}}
						</div>
					</div>
					<div class="flex items-start gap-3 px-4 py-3">
						<span
							class="lucide-alert-triangle size-4 shrink-0 text-ink-gray-5 mt-0.5"
						/>
						<div class="text-sm text-ink-gray-7">
							{{
								__(
									'Closing or refreshing the page will submit your quiz automatically.'
								)
							}}
						</div>
					</div>
					<div
						v-if="quiz.data.duration"
						class="flex items-start gap-3 px-4 py-3"
					>
						<span class="lucide-timer size-4 shrink-0 text-ink-gray-5 mt-0.5" />
						<div class="text-sm text-ink-gray-7">
							{{
								__(
									'The quiz will be submitted automatically when the timer runs out.'
								)
							}}
						</div>
					</div>
					<div
						v-if="quiz.data.enable_negative_marking"
						class="flex items-start gap-3 px-4 py-3"
					>
						<span
							class="lucide-minus-circle size-4 shrink-0 text-ink-gray-5 mt-0.5"
						/>
						<div class="text-sm text-ink-gray-7">
							{{
								__('Wrong answers deduct {0} {1}.').format(
									quiz.data.marks_to_cut,
									quiz.data.marks_to_cut == 1 ? __('mark') : __('marks')
								)
							}}
						</div>
					</div>
				</div>

				<div class="px-5 py-4">
					<template v-if="!questions.length">
						<p class="text-sm text-ink-gray-5 mb-3">
							{{ __('This quiz has no questions available yet.') }}
						</p>
						<Button v-if="inVideo" @click="props.backToVideo()">{{
							__('Resume Video')
						}}</Button>
					</template>
					<template v-else-if="attemptsExhausted">
						<div class="bg-surface-red-1 rounded-lg px-4 py-3 mb-3">
							<div class="text-sm text-ink-red-6 leading-5">
								{{
									__(
										"You've used all {0} {1} for this quiz. Reach out to your instructor if you need to try again."
									).format(
										quiz.data.max_attempts,
										quiz.data.max_attempts == 1 ? __('attempt') : __('attempts')
									)
								}}
							</div>
						</div>
						<Button v-if="inVideo" @click="props.backToVideo()">{{
							__('Resume Video')
						}}</Button>
					</template>
					<template v-else>
						<div class="flex items-center justify-center gap-2">
							<Button
								variant="solid"
								:disabled="!!quiz.data.enable_proctoring && !cameraReady"
								@click="startQuiz"
							>
								{{ __('Start Quiz') }}
							</Button>
							<Button v-if="inVideo" @click="props.backToVideo()">{{
								__('Resume Video')
							}}</Button>
						</div>
						<p
							v-if="quiz.data.enable_proctoring && !cameraReady"
							class="text-xs text-ink-gray-5 text-center mt-2"
						>
							{{
								__(
									'Position your face in the camera to enable the start button.'
								)
							}}
						</p>
					</template>
				</div>
			</div>

			<!-- Camera + Rules (proctored only). Stacked until there is room for two
			     columns: split early, the camera preview and the rule text each get
			     a strip too narrow to read, and every rule wraps to three lines. -->
			<div
				v-if="quiz.data.enable_proctoring && !attemptsExhausted"
				class="grid gap-4 md:grid-cols-2"
			>
				<!-- Camera setup -->
				<div class="border rounded-xl overflow-hidden flex flex-col">
					<div class="px-4 py-3 border-b">
						<div class="text-sm font-semibold text-ink-gray-8">
							{{ __('Camera Setup') }}
						</div>
					</div>
					<!-- The preview is an absolutely-positioned <video>, so it has no
					     height of its own and takes it from this box. Side by side the
					     row supplied one — the rules column is taller — but stacked
					     there is nothing above it to stretch against, so it needs a
					     floor of its own. -->
					<div class="p-4 flex-1 flex flex-col min-h-[18rem] md:min-h-0">
						<ProctoringMonitor
							class="flex-1 flex flex-col min-h-0"
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

				<!-- Proctoring rules -->
				<div class="border rounded-xl overflow-hidden flex flex-col">
					<div class="px-4 py-3 border-b">
						<div class="text-sm font-semibold text-ink-gray-8">
							{{ __('Proctoring Rules') }}
						</div>
					</div>
					<!-- No flex-1 here. With flex-basis 0 the rules contribute nothing to
					     the card's own height, so the card takes it from the row — and
					     when the camera column beside it is the shorter of the two, the
					     last rule falls outside the card and overflow-hidden clips it. -->
					<div class="divide-y">
						<div class="flex items-start gap-3 px-4 py-3">
							<span
								class="lucide-eye-off size-4 shrink-0 text-ink-gray-5 mt-0.5"
							/>
							<div>
								<div class="text-sm text-ink-gray-8 leading-5">
									{{ __('Face must be visible') }}
								</div>
								<div class="text-xs text-ink-gray-5 mt-0.5 leading-5">
									{{ __('Looking away for too long counts as a violation.') }}
								</div>
							</div>
						</div>
						<div class="flex items-start gap-3 px-4 py-3">
							<span
								class="lucide-users size-4 shrink-0 text-ink-gray-5 mt-0.5"
							/>
							<div>
								<div class="text-sm text-ink-gray-8 leading-5">
									{{ __('One person only') }}
								</div>
								<div class="text-xs text-ink-gray-5 mt-0.5 leading-5">
									{{ __('Multiple faces in the frame will be flagged.') }}
								</div>
							</div>
						</div>
						<div class="flex items-start gap-3 px-4 py-3">
							<span
								class="lucide-monitor-x size-4 shrink-0 text-ink-gray-5 mt-0.5"
							/>
							<div>
								<div class="text-sm text-ink-gray-8 leading-5">
									{{ __('Stay on this tab') }}
								</div>
								<div class="text-xs text-ink-gray-5 mt-0.5 leading-5">
									{{
										__(
											'Switching tabs or minimizing the window is flagged immediately.'
										)
									}}
								</div>
							</div>
						</div>
						<div class="flex items-start gap-3 px-4 py-3">
							<span
								class="lucide-camera-off size-4 shrink-0 text-ink-gray-5 mt-0.5"
							/>
							<div>
								<div class="text-sm text-ink-gray-8 leading-5">
									{{ __('Keep camera connected') }}
								</div>
								<div class="text-xs text-ink-gray-5 mt-0.5 leading-5">
									{{ __('Disconnecting your camera counts as a violation.') }}
								</div>
							</div>
						</div>
						<div class="flex items-start gap-3 px-4 py-3 bg-surface-orange-1">
							<span
								class="lucide-alert-triangle size-4 shrink-0 text-ink-orange-5 mt-0.5"
							/>
							<div class="text-sm text-ink-orange-6 leading-5">
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
		<div v-else-if="!quizSubmission.data">
			<div v-for="(question, qtidx) in questions" :key="question.name">
				<div
					v-if="qtidx == activeQuestion - 1 && questionDetails.data"
					class="border rounded-lg p-5"
				>
					<div class="flex flex-wrap items-baseline justify-between gap-x-4">
						<div class="min-w-0 text-sm text-ink-gray-5">
							{{ __('Question {0}').format(activeQuestion) }} -
							{{ getInstructions(questionDetails.data) }}
						</div>
						<div class="shrink-0 text-ink-gray-9 text-sm-semibold">
							{{ question.marks }}
							{{ question.marks == 1 ? __('Mark') : __('Marks') }}
						</div>
					</div>
					<div
						class="text-ink-gray-9 font-semibold mt-2 leading-5 break-words [&_img]:h-auto [&_img]:max-w-full"
						v-safe-html:rich="questionDetails.data.question"
					></div>
					<div
						v-if="questionDetails.data.type == 'Choices'"
						v-for="index in MAX_OPTIONS"
						:key="index"
					>
						<label
							v-if="questionDetails.data[`option_${index}`]"
							class="flex items-center bg-surface-gray-3 rounded-md p-3 mt-4 w-full min-w-0 cursor-pointer focus:border-blue-600"
						>
							<input
								v-if="!showAnswers.length && !questionDetails.data.multiple"
								type="radio"
								:name="encodeURIComponent(questionDetails.data.question)"
								class="w-3.5 h-3.5 shrink-0 text-ink-gray-9 focus:ring-outline-elevation-2"
								@change="markAnswer(index)"
								:checked="selectedOptions[index - 1]"
							/>

							<input
								v-else-if="!showAnswers.length && questionDetails.data.multiple"
								type="checkbox"
								:name="encodeURIComponent(questionDetails.data.question)"
								class="w-3.5 h-3.5 shrink-0 text-ink-gray-9 rounded-sm focus:ring-outline-elevation-2"
								@change="markAnswer(index)"
								:checked="selectedOptions[index - 1]"
							/>
							<div
								v-else-if="quiz.data.show_answers"
								v-for="(answer, idx) in showAnswers"
								:key="idx"
								class="shrink-0"
							>
								<div v-if="index - 1 == idx">
									<span
										v-if="answer == 1"
										class="lucide-check-circle w-4 h-4 text-ink-green-5"
									/>
									<span
										v-else-if="answer == 2"
										class="lucide-minus-circle w-4 h-4 text-ink-green-5"
									/>
									<span
										v-else-if="answer == 0"
										class="lucide-x-circle w-4 h-4 text-ink-red-6"
									/>
									<span v-else class="lucide-minus-circle w-4 h-4" />
								</div>
							</div>
							<span
								class="ms-2 min-w-0 flex-1 break-words text-ink-gray-9 [&_img]:h-auto [&_img]:max-w-full"
								v-safe-html:rich="questionDetails.data[`option_${index}`]"
							>
							</span>
						</label>
						<div
							v-if="questionDetails.data[`explanation_${index}`]"
							class="mt-2 break-words text-xs text-ink-gray-7"
							v-show="showAnswers.length"
						>
							{{ questionDetails.data[`explanation_${index}`] }}
						</div>
					</div>
					<div v-else-if="questionDetails.data.type == 'User Input'">
						<FormControl
							v-model="possibleAnswer"
							type="textarea"
							:disabled="showAnswers.length ? true : false"
							class="my-2"
						/>
						<div v-if="showAnswers.length">
							<Badge v-if="showAnswers[0]" :label="__('Correct')" theme="green">
								<template #prefix>
									<span
										class="lucide-check-circle w-4 h-4 text-ink-green-5 me-1"
									/>
								</template>
							</Badge>
							<Badge v-else theme="red" :label="__('Incorrect')">
								<template #prefix>
									<span class="lucide-x-circle w-4 h-4 text-ink-red-6 me-1" />
								</template>
							</Badge>
						</div>
					</div>
					<div v-else>
						<RichTextEditor
							class="mt-4"
							:content="possibleAnswer"
							@change="(val) => (possibleAnswer = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
					<div class="flex items-center mt-8 gap-4">
						<div class="flex-1">
							<Checkbox
								v-if="!quiz.data.show_answers"
								:label="__('Mark for review')"
								:model-value="reviewQuestions.includes(activeQuestion) ? 1 : 0"
								@change="markForReview($event, activeQuestion)"
							/>
						</div>
						<div
							v-if="!quiz.data.show_answers"
							class="flex flex-wrap items-center gap-2"
						>
							<Button
								:label="__('Previous question')"
								@click="switchQuestion(activeQuestion - 1)"
								:disabled="activeQuestion == 1"
								class="rounded-full"
							>
								<template #icon>
									<span class="lucide-chevron-left size-4" />
								</template>
							</Button>
							<component
								:is="item === '...' ? 'span' : 'button'"
								v-for="(item, pidx) in paginationWindow"
								:key="pidx"
								:type="item === '...' ? null : 'button'"
								class="w-6 h-6 rounded-full flex items-center justify-center text-sm"
								:class="{
									'cursor-pointer': item !== '...',
									'bg-surface-gray-4 border border-outline-gray-7 font-medium':
										activeQuestion == item,
									'text-ink-gray-5': item === '...',
									'bg-surface-blue-2 text-ink-blue-8':
										attemptedQuestions.includes(item) && activeQuestion != item,
									'bg-surface-gray-3 text-ink-gray-6':
										activeQuestion != item &&
										item !== '...' &&
										!attemptedQuestions.includes(item),
								}"
								@click="item !== '...' && switchQuestion(item)"
							>
								{{ item }}
							</component>

							<Button
								:label="__('Next question')"
								@click="switchQuestion(activeQuestion + 1)"
								:disabled="activeQuestion == questions.length"
								class="rounded-full"
							>
								<template #icon>
									<span class="lucide-chevron-right size-4" />
								</template>
							</Button>
						</div>
						<div class="flex-1 flex justify-end">
							<Button
								v-if="
									quiz.data.show_answers &&
									!showAnswers.length &&
									questionDetails.data.type != 'Open Ended'
								"
								@click="checkAnswer()"
							>
								<span>{{ __('Check') }}</span>
							</Button>
							<Button
								v-else-if="activeQuestion != questions.length"
								@click="
									quiz.data.show_answers
										? nextQuestion()
										: switchQuestion(activeQuestion + 1)
								"
							>
								<span>{{ __('Next') }}</span>
							</Button>
							<Button variant="solid" v-else @click="handleSubmitClick()">
								<span>{{ __('Submit') }}</span>
							</Button>
						</div>
					</div>
				</div>
			</div>
			<!-- Activity log (shown during quiz, below the question card) -->
			<div
				v-if="quiz.data.enable_proctoring && summaryLog.length"
				class="border rounded-lg overflow-hidden mt-4"
			>
				<div
					class="px-4 py-2.5 border-b flex items-center justify-between bg-surface-gray-1"
				>
					<span class="text-xs font-semibold text-ink-gray-8">{{
						__('Activity')
					}}</span>
					<span class="text-xs text-ink-gray-5"
						>{{ summaryLog.length }}
						{{ summaryLog.length == 1 ? __('event') : __('events') }}</span
					>
				</div>
				<div class="divide-y max-h-64 overflow-y-auto">
					<div
						v-for="(entry, i) in summaryLog"
						:key="i"
						class="flex items-center gap-2.5 px-4 py-2.5"
					>
						<span
							class="size-1.5 rounded-full shrink-0"
							:class="
								entry.severity === 'violation'
									? 'bg-ink-red-6'
									: 'bg-ink-orange-6'
							"
						/>
						<span class="text-sm text-ink-gray-7 flex-1">{{
							violationEventLabels[entry.eventType] || entry.eventType
						}}</span>
						<!-- What the camera saw as the event fired. The stored file is shown
						     rather than the frame the browser still holds: it is the same record
						     the instructor reads, and safeUrl drops a data: URI in any case. -->
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
								class="h-8 w-11 rounded border object-cover"
							/>
						</a>
						<span
							class="text-xs font-medium uppercase tracking-wide shrink-0"
							:class="
								entry.severity === 'violation'
									? 'text-ink-red-6'
									: 'text-ink-orange-6'
							"
						>
							{{
								entry.severity === 'violation' ? __('Violation') : __('Warning')
							}}
						</span>
					</div>
				</div>
			</div>

			<div v-if="reviewQuestions.length" class="border rounded-lg p-4 mt-4">
				<div class="font-semibold">
					{{ __('Questions marked for review') }}
				</div>
				<div class="flex flex-wrap items-center gap-2 mt-2">
					<button
						v-for="index in reviewQuestions"
						:key="index"
						type="button"
						@click="switchQuestion(index)"
						class="w-6 h-6 rounded-full flex items-center justify-center text-sm cursor-pointer bg-surface-gray-3"
					>
						{{ index }}
					</button>
				</div>
			</div>
		</div>
		<div v-else class="space-y-4">
			<div class="border rounded-lg overflow-hidden">
				<!-- Violation banner shown when quiz was auto-submitted due to max violations -->
				<div
					v-if="
						quiz.data.enable_proctoring && submissionReason === 'max_violations'
					"
					class="bg-surface-red-2 px-5 py-4 border-b border-outline-red-2"
				>
					<div class="flex items-center gap-2.5 mb-1">
						<span class="lucide-shield-x size-4 text-ink-red-6 shrink-0" />
						<span class="text-sm font-semibold text-ink-red-7">{{
							__('Maximum violations reached')
						}}</span>
					</div>
					<p class="text-sm text-ink-red-6 leading-5 ps-6.5">
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
				<div class="p-10 space-y-2 text-center">
					<div class="text-lg-semibold text-ink-gray-9">
						{{ __('Quiz Summary') }}
					</div>
					<div
						v-if="quizSubmission.data.is_open_ended"
						class="leading-5 text-ink-gray-7"
					>
						{{
							__(
								"Your submission has been successfully saved. The instructor will review and grade it shortly, and you'll be notified of your final result."
							)
						}}
					</div>
					<div v-else class="text-ink-gray-7">
						{{
							__(
								'You got {0}% correct answers with a score of {1} out of {2}'
							).format(
								Math.ceil(quizSubmission.data.percentage),
								quizSubmission.data.score,
								quizSubmission.data.score_out_of
							)
						}}
					</div>
					<div class="flex items-center justify-center gap-x-2 pt-1">
						<Button
							@click="resetQuiz()"
							v-if="
								!quiz.data.max_attempts ||
								attempts?.data.length < quiz.data.max_attempts
							"
						>
							<span>
								{{ __('Try Again') }}
							</span>
						</Button>
						<Button v-if="inVideo" @click="props.backToVideo()">
							{{ __('Resume Video') }}
						</Button>
					</div>
				</div>
			</div>
			<!-- Activity log persists into summary view for proctored quizzes -->
			<div
				v-if="quiz.data.enable_proctoring && summaryLog.length"
				class="border rounded-lg overflow-hidden"
			>
				<div
					class="px-4 py-2.5 border-b flex items-center justify-between bg-surface-gray-1"
				>
					<span class="text-xs font-semibold text-ink-gray-8">{{
						__('Activity')
					}}</span>
					<span class="text-xs text-ink-gray-5"
						>{{ summaryLog.length }}
						{{ summaryLog.length == 1 ? __('event') : __('events') }}</span
					>
				</div>
				<div class="divide-y max-h-64 overflow-y-auto">
					<div
						v-for="(entry, i) in summaryLog"
						:key="i"
						class="flex items-center gap-2.5 px-4 py-2.5"
					>
						<span
							class="size-1.5 rounded-full shrink-0"
							:class="
								entry.severity === 'violation'
									? 'bg-ink-red-6'
									: 'bg-ink-orange-6'
							"
						/>
						<span class="text-sm text-ink-gray-7 flex-1">{{
							violationEventLabels[entry.eventType] || entry.eventType
						}}</span>
						<!-- What the camera saw as the event fired. The stored file is shown
						     rather than the frame the browser still holds: it is the same record
						     the instructor reads, and safeUrl drops a data: URI in any case. -->
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
								class="h-8 w-11 rounded border object-cover"
							/>
						</a>
						<span
							class="text-xs font-medium uppercase tracking-wide shrink-0"
							:class="
								entry.severity === 'violation'
									? 'text-ink-red-6'
									: 'text-ink-orange-6'
							"
						>
							{{
								entry.severity === 'violation' ? __('Violation') : __('Warning')
							}}
						</span>
					</div>
				</div>
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
				:rows="attempts?.data"
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
						<span class="text-ink-green-7 font-medium"
							>{{ attemptedQuestions.length }} {{ __('attempted') }}</span
						>
						<span
							:class="
								questions.length - attemptedQuestions.length > 0
									? 'text-ink-orange-7 font-medium'
									: 'text-ink-gray-5'
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
<script setup>
import {
	Badge,
	Button,
	call,
	Checkbox,
	createResource,
	Dialog,
	LoadingIndicator,
	FormControl,
	toast,
} from 'frappe-ui'
import {
	computed,
	inject,
	onMounted,
	onUnmounted,
	reactive,
	ref,
	watch,
} from 'vue'
import { timeAgo } from '@/utils/format'
import { safeUrl } from '@/utils/safeUrl'
import ProgressBar from '@/components/ProgressBar.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import ProctoringMonitor from '@/components/ProctoringMonitor.vue'

const user = inject('$user')
const activeQuestion = ref(0)
const currentQuestion = ref('')
const MAX_OPTIONS = 10
const selectedOptions = ref(Array(MAX_OPTIONS).fill(0))
const showAnswers = reactive([])
const questions = ref([])
const attemptedQuestions = ref([])
const reviewQuestions = ref([])
const showSubmissionConfirmation = ref(false)
const possibleAnswer = ref(null)
const timer = ref(0)
let timerInterval = null
const violationCount = ref(0)
const proctoringActive = ref(false)
const cameraReady = ref(false)
const violationLog = ref([])
const submissionReason = ref('')
let submitTimeout = null

const props = defineProps({
	quizName: {
		type: String,
		required: true,
	},
	inVideo: {
		type: Boolean,
		default: false,
	},
	backToVideo: {
		type: Function,
		default: () => {},
	},
})

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
const serialiseViolationLog = (withFrames = true) =>
	JSON.stringify(
		[...violationLog.value]
			.reverse()
			.map(({ frame, ...event }) => (withFrames ? { ...event, frame } : event))
	)

const handlePageHide = () => {
	if (activeQuestion.value > 0 && !quizSubmission.data) {
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

const handleBeforeUnload = (event) => {
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
const questionsByName = ref({})
const quiz = createResource({
	url: 'lms.lms.utils.get_quiz_with_questions',
	makeParams() {
		return { quiz: props.quizName }
	},
	// Keep this resource instance-local: its callbacks update component-local
	// question and timer state on every mount.
	auto: true,
	transform(data) {
		const quizDoc = data?.quiz || {}
		quizDoc.duration = parseInt(quizDoc.duration)
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
		(row) => row?.question && questionsByName.value[row.question]
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
	timerInterval = null
	// submitQuiz() defers createSubmission() by 500ms so the last answer can be
	// written to localStorage first. Left pending, it fires against an unmounted
	// or already-switched component and marks progress on the wrong lesson.
	clearTimeout(submitTimeout)
	submitTimeout = null
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

const formatTimer = (seconds) => {
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

const attemptsExhausted = computed(
	() =>
		!!quiz.data?.max_attempts &&
		(attempts.data?.length ?? 0) >= quiz.data.max_attempts
)

const shuffleArray = (array) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[array[i], array[j]] = [array[j], array[i]]
	}
	return array
}

const attempts = createResource({
	url: 'frappe.client.get_list',
	makeParams(values) {
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
	transform(data) {
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

const quizSubmission = createResource({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz',
	makeParams(values) {
		return {
			quiz: quiz.data.name,
			results: localStorage.getItem(quiz.data.title) || '[]',
			violation_count: values?.violation_count ?? violationCount.value,
			submission_reason: values?.submission_reason ?? 'manual',
			violation_events: serialiseViolationLog(),
		}
	},
})

// Mirror the previous createResource shape ({ data: ... }) so existing
// template refs (questionDetails.data.option_X, etc.) keep working. We
// just pull the row from the pre-fetched map instead of an API call.
const questionDetails = reactive({ data: null })

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

const switchQuestion = (questionNumber) => {
	let answers = getAnswers()
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

const loadSavedAnswers = () => {
	let quizData = JSON.parse(localStorage.getItem(quiz.data.title))
	if (quizData) {
		let localQuestion = quizData.find(
			(q) => q.question_name == currentQuestion.value
		)
		if (localQuestion) {
			let localAnswers = localQuestion.answer
			if (localAnswers.length) {
				if (questionDetails.data.type == 'Choices') {
					localAnswers.forEach((answer) => {
						for (let i = 1; i <= MAX_OPTIONS; i++) {
							if (questionDetails.data[`option_${i}`] == answer) {
								selectedOptions.value[i - 1] = 1
							}
						}
					})
				} else {
					possibleAnswer.value = localAnswers[0]
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
	activeQuestion.value = 1
	localStorage.removeItem(quiz.data.title)
	if (quiz.data.duration) startTimer()
	if (quiz.data.enable_proctoring) proctoringActive.value = true
}

// The stored log, read back after submitting. It is the same rows an instructor
// sees, and unlike the client's own list it carries the camera stills as file URLs
// rather than data: URIs.
const storedViolationLog = createResource({
	url: 'lms.lms.doctype.lms_quiz.lms_quiz.get_quiz_violation_logs',
	makeParams() {
		return { submission: quizSubmission.data?.submission }
	},
})

watch(
	() => quizSubmission.data?.submission,
	(submission) => {
		if (submission) storedViolationLog.fetch()
	}
)

// Prefer the stored log once it lands. Before that — and during the quiz itself,
// where there is no submission to read — the client's own list stands in, so the
// activity table is never empty while events are happening.
const summaryLog = computed(() =>
	storedViolationLog.data?.length
		? storedViolationLog.data.map((row) => ({
				eventType: row.event_type,
				severity: row.severity,
				timestamp: row.timestamp,
				frame: row.frame,
		  }))
		: violationLog.value
)

const violationEventLabels = {
	tab_switch: __('Tab switch'),
	no_face: __('Face not visible'),
	multiple_faces: __('Multiple faces'),
	focus_loss: __('Window focus lost'),
	camera_disconnect: __('Camera disconnected'),
}

const handleViolation = (eventType, frame = null) => {
	if (submissionReason.value || quizSubmission.loading || quizSubmission.data)
		return
	violationCount.value++
	violationLog.value.unshift({
		eventType,
		severity: 'violation',
		timestamp: new Date().toISOString(),
		frame,
	})
	const remaining = quiz.data.max_violations - violationCount.value
	if (remaining <= 0) {
		submitQuiz('max_violations')
	} else {
		const label = violationEventLabels[eventType] || __('Proctoring violation')
		toast.warning(label + '. ' + __('Remaining: {0}').format(remaining))
	}
}

const handleWarning = (eventType, frame = null) => {
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

const markAnswer = (index) => {
	if (!questionDetails.data.multiple)
		selectedOptions.value.splice(
			0,
			selectedOptions.value.length,
			...Array(MAX_OPTIONS).fill(0)
		)
	selectedOptions.value[index - 1] = selectedOptions.value[index - 1] ? 0 : 1
}

const getAnswers = () => {
	let answers = []
	if (!questionDetails.data) return answers
	const type = questionDetails.data.type
	if (type == 'Choices') {
		selectedOptions.value.forEach((value, index) => {
			if (selectedOptions.value[index])
				answers.push(questionDetails.data[`option_${index + 1}`])
		})
	} else {
		answers.push(possibleAnswer.value)
	}

	return answers
}

const checkAnswer = () => {
	let answers = getAnswers()
	if (!answers.length) {
		toast.warning(__('Please select an option'))
		return
	}

	createResource({
		url: 'lms.lms.doctype.lms_quiz.lms_quiz.check_answer',
		params: {
			quiz: quiz.data.name,
			question: currentQuestion.value,
			question_type: questionDetails.data.type,
			answers: JSON.stringify(answers),
		},
		auto: true,
		onSuccess(data) {
			let type = questionDetails.data.type
			if (type == 'Choices') {
				selectedOptions.value.forEach((option, index) => {
					if (option) {
						showAnswers[index] = option && data[index]
					} else if (data[index] == 2) {
						showAnswers[index] = 2
					} else {
						showAnswers[index] = undefined
					}
				})
			} else {
				showAnswers.push(data)
			}
			addToLocalStorage()
			if (!quiz.data.show_answers) {
				resetQuestion()
			}
		},
	})
}

const addToLocalStorage = () => {
	let quizData = JSON.parse(localStorage.getItem(quiz.data.title))
	let questionData = {
		question_name: currentQuestion.value,
		answer: getAnswers(),
	}
	if (quizData) {
		let existingQuestion = quizData.find(
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

const nextQuestion = () => {
	if (!quiz.data.show_answers) return
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

const submitQuiz = (reason = 'manual') => {
	submissionReason.value = reason
	if (!quiz.data.show_answers) {
		if (questionDetails.data?.type == 'Open Ended' || getAnswers().length) {
			addToLocalStorage()
		}
		submitTimeout = setTimeout(() => {
			submitTimeout = null
			createSubmission(reason)
		}, 500)
		return
	}
	createSubmission(reason)
}

const createSubmission = (reason = 'manual') => {
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
			onSuccess(data) {
				proctoringActive.value = false
				if (props.quizName !== submittedQuiz) return
				markLessonProgress()
				if (quiz.data && quiz.data.max_attempts) attempts.reload()
				stopTimer()
			},
			onError(err) {
				const errorTitle = err?.message || ''
				if (errorTitle.includes('MaximumAttemptsExceededError')) {
					const errorMessage = err.messages?.[0] || err
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

const getInstructions = (question) => {
	if (question.type == 'Choices')
		if (question.multiple) return __('Choose all answers that apply')
		else return __('Choose one answer')
	else return __('Type your answer')
}

const markLessonProgress = () => {
	let pathname = window.location.pathname.split('/')
	if (!pathname.includes('courses'))
		pathname = window.parent.location.pathname.split('/')
	if (pathname[2] != 'courses') return
	let lessonIndex = pathname.pop().split('-')

	if (lessonIndex.length == 2) {
		call('lms.lms.api.mark_lesson_progress', {
			course: pathname[3],
			chapter_number: lessonIndex[0],
			lesson_number: lessonIndex[1],
		})
	}
}

const handleSubmitClick = () => {
	if (!quiz.data.show_answers) {
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

const paginationWindow = computed(() => {
	const total = questions.value.length
	const current = activeQuestion.value
	const pages = []
	const size = 5

	let start = Math.floor((current - 1) / size) * size + 1
	let end = Math.min(start + size - 1, total)

	if (start > 1) {
		pages.push('...')
	}

	for (let i = start; i <= end; i++) {
		pages.push(i)
	}

	if (end < total) {
		pages.push('...')
	}

	return pages
})

const markForReview = (event, questionNumber) => {
	if (event.target.checked) {
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
