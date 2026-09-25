<template>
	<TeacherPage :breadcrumbs="breadcrumbs" :state="page">
		<template #actions>
			<router-link
				v-if="review?.neighbours?.previous"
				:to="reviewRoute(review.neighbours.previous)"
			>
				<HeaderButton
					:label="__('Previous')"
					icon="lucide-chevron-left"
					variant="ghost"
				/>
			</router-link>
			<router-link
				v-if="review?.neighbours?.next"
				:to="reviewRoute(review.neighbours.next)"
			>
				<HeaderButton
					:label="__('Next')"
					icon="lucide-chevron-right"
					variant="ghost"
				/>
			</router-link>
		</template>

		<div v-if="review" class="space-y-4">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="me-2 text-lg-semibold text-ink-gray-9">
					{{ review.assignment_title || review.assignment }}
					<span class="text-ink-gray-5">— {{ review.learner_name || '' }}</span>
				</h1>
				<Badge
					v-if="review.submission?.commit"
					variant="subtle"
					theme="gray"
					:label="__('commit {0}').format(review.submission.commit.slice(0, 7))"
				/>
				<Badge
					variant="subtle"
					theme="gray"
					:label="
						__('Submitted {0}').format(
							formatDate(review.submission?.submitted_on)
						)
					"
				/>
				<Badge
					v-if="review.course_title"
					variant="subtle"
					theme="gray"
					:label="review.course_title"
				/>
			</div>

			<div class="grid gap-4 lg:grid-cols-2">
				<section class="min-w-0 rounded-lg border border-outline-gray-2 p-4">
					<TeacherEvidencePane
						ref="evidence"
						:key="review.draft"
						:submission="review.submission"
						:scores="review.scores"
					/>
				</section>

				<section
					class="min-w-0 space-y-4 rounded-lg border border-outline-gray-2 p-4"
				>
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-base-semibold text-ink-gray-9">
							{{ __('Draft feedback') }}
						</h2>
						<Badge
							variant="subtle"
							theme="violet"
							:label="__('Drafted by AI')"
						/>
						<span class="flex-1" />
						<Badge
							v-if="review.rubric"
							variant="subtle"
							theme="gray"
							:label="__('Rubric: {0}').format(review.rubric.title)"
						/>
					</div>

					<div class="space-y-3">
						<TeacherScoreCard
							v-for="score in review.scores"
							:key="score.criterion"
							:score="score"
							:model-value="levels[score.criterion]"
							:editable="open"
							@update:model-value="setLevel(score.criterion, $event)"
							@cite="evidence?.show($event)"
						/>
					</div>

					<FormControl
						v-model="message"
						type="textarea"
						:rows="8"
						:disabled="!open"
						:label="__('Message to the learner (editable)')"
						data-testid="copilot-message"
					/>

					<div class="flex items-center gap-3">
						<label for="copilot-result" class="text-p-sm text-ink-gray-5">{{
							__('Result')
						}}</label>
						<select
							id="copilot-result"
							v-model="resultStatus"
							class="form-select h-7 rounded border-outline-gray-2 bg-surface-gray-2 py-0 text-p-base"
							:disabled="!open"
							data-testid="copilot-result"
							@change="resultTouched = true"
						>
							<option
								v-for="option in resultOptions"
								:key="option.value"
								:value="option.value"
							>
								{{ option.label }}
							</option>
						</select>
					</div>

					<div
						v-if="open"
						class="flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4"
					>
						<Button
							variant="solid"
							:label="__('Approve and send')"
							:loading="busy === 'approve'"
							data-testid="copilot-approve"
							@click="approve"
						/>
						<Button
							:label="__('Save draft')"
							:loading="busy === 'save'"
							@click="save"
						/>
						<Button
							variant="ghost"
							:label="__('Ask the assistant to rewrite…')"
							@click="showRewrite = true"
						/>
						<span class="flex-1" />
						<Button
							variant="ghost"
							:label="__('Grade it myself')"
							@click="showDiscard = true"
						/>
					</div>
					<div
						v-else
						class="flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4"
					>
						<TeacherStatusBadge :status="review.status" />
						<Badge
							v-if="review.edit_level"
							variant="subtle"
							theme="gray"
							:label="__('Edit: {0}').format(editLevelLabel(review.edit_level))"
						/>
						<span v-if="review.reviewed_by" class="text-p-sm text-ink-gray-5">
							{{ __('by {0}').format(review.reviewed_by) }}
						</span>
					</div>
				</section>
			</div>
		</div>

		<TeacherNoteDialog
			v-model:open="showRewrite"
			:title="__('What should the assistant change?')"
			input
			required
			:input-label="__('Instructions')"
			:confirm-label="__('Send to assistant')"
			@confirm="rewrite"
		/>
		<TeacherNoteDialog
			v-model:open="showDiscard"
			:title="__('Discard this draft?')"
			:body="
				__(
					'The learner sees nothing from it. Grade the submission in the LMS as usual.'
				)
			"
			input
			:input-label="__('Reason (optional)')"
			:confirm-label="__('Discard draft')"
			confirm-theme="red"
			@confirm="discard"
		/>
	</TeacherPage>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, FormControl, toast, usePageMeta } from 'frappe-ui'
import HeaderButton from '@/components/HeaderButton.vue'
import TeacherPage from '@/components/Copilot/teacher/TeacherPage.vue'
import TeacherNoteDialog from '@/components/Copilot/teacher/TeacherNoteDialog.vue'
import TeacherEvidencePane from '@/components/Copilot/teacher/TeacherEvidencePane.vue'
import TeacherScoreCard from '@/components/Copilot/teacher/TeacherScoreCard.vue'
import TeacherStatusBadge from '@/components/Copilot/teacher/TeacherStatusBadge.vue'
import { useTeacherData } from '@/components/Copilot/teacher/useTeacherData'
import { runAction } from '@/components/Copilot/teacher/actions'
import {
	editLevelLabel,
	formatDate,
	suggestedResult,
} from '@/components/Copilot/teacher/format'
import { copilotCall } from '@/copilot/api'

const props = defineProps({
	draft: { type: String, required: true },
})

const router = useRouter()
const evidence = ref(null)
const levels = reactive({})
const message = ref('')
const resultStatus = ref('Pass')
const resultTouched = ref(false)
const busy = ref(null)
const showRewrite = ref(false)
const showDiscard = ref(false)

const page = useTeacherData(
	() => copilotCall('get_feedback_review', { draft: props.draft }),
	() => props.draft
)

const review = computed(() => page.data.value)
const open = computed(() => review.value?.status === 'Pending Review')

const resultOptions = computed(() => [
	{ value: 'Pass', label: __('Pass') },
	{ value: 'Fail', label: __('Fail') },
	{ value: 'Not Graded', label: __('Not Graded') },
])

const breadcrumbs = computed(() => [
	{ label: __('Review queue'), route: { name: 'CopilotQueue' } },
	{
		label: review.value
			? `${review.value.assignment_title || review.value.assignment} — ${
					review.value.learner_name || ''
				}`
			: props.draft,
		route: { name: 'CopilotFeedbackReview', params: { draft: props.draft } },
	},
])

watch(
	review,
	(data) => {
		if (!data) return
		for (const key of Object.keys(levels)) delete levels[key]
		for (const score of data.scores || []) {
			levels[score.criterion] = score.final_level || score.level
		}
		message.value = data.final_message || data.message || ''
		resultTouched.value = Boolean(data.result_status)
		resultStatus.value = data.result_status || suggestedResult(levels)
	},
	{ immediate: true }
)

function setLevel(criterion, level) {
	levels[criterion] = level
	if (!resultTouched.value) resultStatus.value = suggestedResult(levels)
}

function reviewRoute(name) {
	return { name: 'CopilotFeedbackReview', params: { draft: name } }
}

function goNext() {
	const next = review.value?.neighbours?.next
	router.push(next ? reviewRoute(next) : { name: 'CopilotQueue' })
}

const edits = () => ({ scores: { ...levels }, message: message.value })

async function approve() {
	busy.value = 'approve'
	const result = await runAction(() =>
		copilotCall('approve_feedback', {
			draft: props.draft,
			...edits(),
			result_status: resultStatus.value,
		})
	)
	busy.value = null
	if (!result) return
	toast.success(__('Feedback sent to the learner.'))
	goNext()
}

async function save() {
	busy.value = 'save'
	await runAction(
		() =>
			copilotCall('save_feedback_draft', { draft: props.draft, ...edits() }),
		__('Draft saved.')
	)
	busy.value = null
}

async function rewrite(note) {
	const result = await runAction(
		() => copilotCall('request_feedback_rewrite', { draft: props.draft, note }),
		__('Sent back to the assistant.')
	)
	if (result) goNext()
}

async function discard(note) {
	const result = await runAction(
		() => copilotCall('reject_feedback', { draft: props.draft, note }),
		__('Draft discarded.')
	)
	if (result) goNext()
}

usePageMeta(() => ({
	title: review.value?.assignment_title || __('Review queue'),
}))
</script>
