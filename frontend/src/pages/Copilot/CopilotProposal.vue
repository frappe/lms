<template>
	<TeacherPage :breadcrumbs="breadcrumbs" :state="page">
		<section
			v-if="detail"
			class="space-y-4 rounded-6 border border-outline-gray-2 p-5"
		>
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="me-2 text-lg-semibold text-ink-gray-9">
					{{ detail.title || detail.name }}
				</h1>
				<Badge
					variant="subtle"
					theme="violet"
					:label="kindLabel(detail.type)"
				/>
				<TeacherStatusBadge :status="detail.status" />
			</div>

			<p class="text-p-sm text-ink-gray-5" data-testid="copilot-proposal-meta">
				<template v-if="detail.course_title">
					<router-link
						v-if="detail.course"
						:to="{
							name: 'CourseDetail',
							params: { courseName: detail.course },
						}"
						class="underline"
						>{{ detail.course_title }}</router-link
					><span v-else>{{ detail.course_title }}</span>
					·
				</template>
				{{ metaLine }}
			</p>

			<p
				v-if="detail.error"
				class="rounded bg-surface-red-2 px-3 py-2 text-p-base text-ink-red-8"
				role="alert"
			>
				{{ detail.error }}
			</p>

			<p
				v-if="detail.summary"
				class="whitespace-pre-wrap text-p-base text-ink-gray-8"
			>
				{{ detail.summary }}
			</p>

			<!-- Course draft -->
			<template v-if="preview.kind === 'course'">
				<TeacherCourseDraftView :preview="preview" />
				<div
					v-if="open && preview.missing"
					class="space-y-2 rounded-6 bg-surface-amber-2 p-3"
				>
					<label
						for="copilot-missing"
						class="block text-p-base font-medium text-ink-amber-8"
					>
						{{
							__(
								'{0} lesson(s) have no source material in your documents.'
							).format(preview.missing)
						}}
					</label>
					<select
						id="copilot-missing"
						ref="missingField"
						v-model="missingChoice"
						class="form-select w-full rounded border-outline-gray-2 bg-surface-base text-p-base sm:w-auto"
						:aria-label="__('Lessons without source material')"
						data-testid="copilot-missing"
					>
						<option value="">{{ __('Choose what to do with them…') }}</option>
						<option value="keep">
							{{ __('Keep them, marked for me to complete') }}
						</option>
						<option value="drop">{{ __('Drop them from the course') }}</option>
					</select>
				</div>
				<p v-if="detail.status === 'Applied' && detail.result?.course">
					<router-link
						:to="{
							name: 'CourseDetail',
							params: { courseName: detail.result.course },
						}"
						class="text-p-base text-ink-gray-9 underline"
					>
						{{ __('Open the new course (unpublished)') }}
					</router-link>
				</p>
			</template>

			<!-- Lesson change, quiz, rubric -->
			<template v-else-if="preview.kind === 'diff'">
				<TeacherDiffView :lines="preview.lines || []" />
				<FormControl
					v-if="detail.type === 'Lesson Change' && open && editing"
					v-model="editorText"
					type="textarea"
					:rows="10"
					class="font-mono"
					:label="__('Lesson text')"
					data-testid="copilot-lesson-editor"
				/>
			</template>

			<!-- Learner reminder -->
			<template v-else-if="preview.kind === 'message'">
				<p class="text-p-sm text-ink-gray-5">
					{{
						__('To {0} learner(s): {1}').format(
							(preview.recipients || []).length,
							(preview.recipients || []).join(', ')
						)
					}}
				</p>
				<FormControl
					v-model="editorText"
					type="textarea"
					:rows="5"
					:disabled="!open"
					:label="__('Reminder')"
					data-testid="copilot-reminder"
				/>
			</template>

			<!-- Escalated question -->
			<template v-else-if="preview.kind === 'question'">
				<blockquote
					class="whitespace-pre-wrap border-s-4 border-outline-gray-3 ps-3 text-p-base text-ink-gray-8"
				>
					{{ preview.question }}
				</blockquote>
				<FormControl
					v-if="open"
					v-model="reply"
					type="textarea"
					:rows="5"
					:label="__('Your reply is sent to the learner as a notification.')"
					data-testid="copilot-reply"
				/>
				<div
					v-else-if="params.reply"
					class="whitespace-pre-wrap rounded-6 border border-outline-gray-2 p-3 text-p-base text-ink-gray-8"
				>
					{{ params.reply }}
				</div>
			</template>

			<p
				v-if="detail.result && detail.status === 'Applied'"
				class="text-p-sm text-ink-gray-5"
			>
				{{ __('Re-read after applying: the change is in place.') }}
			</p>

			<div
				class="flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4"
			>
				<template v-if="open">
					<Button
						variant="solid"
						:label="
							detail.type === 'Escalation'
								? __('Send reply')
								: __('Approve and apply')
						"
						:loading="busy"
						data-testid="copilot-approve"
						@click="approve"
					/>
					<Button
						v-if="detail.type === 'Lesson Change'"
						:label="__('Edit')"
						:aria-pressed="editing ? 'true' : 'false'"
						data-testid="copilot-edit"
						@click="editing = !editing"
					/>
					<Button
						variant="ghost"
						:label="__('Reject')"
						@click="showReject = true"
					/>
				</template>
				<template v-else>
					<TeacherStatusBadge :status="detail.status" />
					<span v-if="detail.reviewed_by" class="text-p-sm text-ink-gray-5">
						{{ __('by {0}').format(detail.reviewed_by) }}
					</span>
				</template>
			</div>
		</section>

		<TeacherNoteDialog
			v-model:open="showReject"
			:title="__('Reject this proposal?')"
			input
			:input-label="__('Reason (optional)')"
			:confirm-label="__('Reject')"
			confirm-theme="red"
			@confirm="reject"
		/>
	</TeacherPage>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Badge, Button, FormControl, toast, usePageMeta } from 'frappe-ui'
import TeacherPage from '@/components/Copilot/teacher/TeacherPage.vue'
import TeacherNoteDialog from '@/components/Copilot/teacher/TeacherNoteDialog.vue'
import TeacherStatusBadge from '@/components/Copilot/teacher/TeacherStatusBadge.vue'
import TeacherDiffView from '@/components/Copilot/teacher/TeacherDiffView.vue'
import TeacherCourseDraftView from '@/components/Copilot/teacher/TeacherCourseDraftView.vue'
import { useTeacherData } from '@/components/Copilot/teacher/useTeacherData'
import { runAction } from '@/components/Copilot/teacher/actions'
import {
	formatDate,
	kindLabel,
	statusLabel,
	viaLabel,
} from '@/components/Copilot/teacher/format'
import { copilotCall } from '@/copilot/api'

const props = defineProps({
	proposal: { type: String, required: true },
})

const busy = ref(false)
const editing = ref(false)
const editorText = ref('')
const reply = ref('')
const missingChoice = ref('')
const missingField = ref(null)
const showReject = ref(false)

const page = useTeacherData(
	() => copilotCall('get_proposal', { name: props.proposal }),
	() => props.proposal
)

const detail = computed(() => page.data.value)
const open = computed(() => detail.value?.status === 'Pending')
const preview = computed(() => detail.value?.preview || {})
const params = computed(
	() => detail.value?.final_params || detail.value?.params || {}
)

const breadcrumbs = computed(() => [
	{ label: __('Review queue'), route: { name: 'CopilotQueue' } },
	{
		label: detail.value?.title || props.proposal,
		route: { name: 'CopilotProposal', params: { proposal: props.proposal } },
	},
])

const metaLine = computed(() => {
	const data = detail.value
	if (!data) return ''
	return [
		__('Requested by {0} ({1})').format(
			data.requested_by_name || data.requested_by || '',
			viaLabel(data.requested_via)
		),
		formatDate(data.created),
		open.value && data.expires_on
			? __('Expires {0}').format(formatDate(data.expires_on))
			: null,
	]
		.filter(Boolean)
		.join(' · ')
})

watch(
	detail,
	(data) => {
		if (!data) return
		editing.value = false
		reply.value = ''
		missingChoice.value = ''
		if (preview.value.kind === 'message') {
			editorText.value = params.value.message || preview.value.message || ''
		} else {
			editorText.value = params.value.markdown || ''
		}
	},
	{ immediate: true }
)

// What the reviewer changed, in the shape approve_proposal expects.
function approveParams() {
	const data = detail.value
	if (preview.value.kind === 'question' && open.value)
		return { reply: reply.value }
	if (preview.value.kind === 'course' && preview.value.missing) {
		return { missing_lessons: missingChoice.value }
	}
	if (data.type === 'Lesson Change' && editing.value) {
		return { ...params.value, markdown: editorText.value }
	}
	if (data.type === 'Learner Reminder') {
		return { ...params.value, message: editorText.value }
	}
	return null
}

async function approve() {
	if (preview.value.kind === 'question' && !reply.value.trim()) {
		toast.error(__('Write a reply first.'))
		return
	}
	if (
		preview.value.kind === 'course' &&
		preview.value.missing &&
		!missingChoice.value
	) {
		missingField.value?.focus()
		toast.error(
			__('Choose what to do with the lessons that have no source material.')
		)
		return
	}
	busy.value = true
	const result = await runAction(() =>
		copilotCall('approve_proposal', {
			name: props.proposal,
			params: approveParams(),
		})
	)
	busy.value = false
	if (!result) return
	if (result.status === 'Applied') toast.success(__('Applied and verified.'))
	else toast.error(result.error || statusLabel(result.status))
	page.reload({ quiet: true })
}

async function reject(note) {
	const result = await runAction(
		() => copilotCall('reject_proposal', { name: props.proposal, note }),
		__('Rejected.')
	)
	if (result) page.reload({ quiet: true })
}

usePageMeta(() => ({ title: detail.value?.title || __('Review queue') }))
</script>
