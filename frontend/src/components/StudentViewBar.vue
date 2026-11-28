<template>
	<div
		ref="bar"
		class="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-outline-gray-2 bg-surface-base px-5 py-2"
		role="region"
		:aria-label="__('Student view')"
	>
		<div class="flex min-w-0 items-center gap-2 text-p-sm text-ink-gray-7">
			<span class="lucide-eye size-4 shrink-0" />
			<span class="text-p-sm-medium text-ink-gray-9">
				{{ __('Student view') }}
			</span>
			<span class="hidden truncate sm:inline">
				· {{ __('Nothing you do here is saved to a real learner') }}
			</span>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button
				v-if="mode === 'enrolled'"
				variant="ghost"
				:loading="reset.loading"
				:aria-label="__('Reset progress')"
				:icon="isMobile ? 'lucide-rotate-ccw' : undefined"
				:icon-left="isMobile ? undefined : 'lucide-rotate-ccw'"
				@click="showReset = true"
			>
				{{ __('Reset progress') }}
			</Button>
			<TabButtons v-model="mode" :options="modes" />
			<Button
				variant="outline"
				:aria-label="__('Exit student view')"
				:icon="isMobile ? 'lucide-x' : undefined"
				:icon-left="isMobile ? undefined : 'lucide-x'"
				@click="emit('exit')"
			>
				{{ __('Exit') }}
			</Button>
		</div>
	</div>
	<Dialog
		v-model:open="showReset"
		:title="__('Reset your progress?')"
		:message="resetMessage"
		:actions="[
			{
				label: __('Reset progress'),
				variant: 'solid',
				theme: 'red',
				onClick: resetProgress,
			},
		]"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, createResource, Dialog, TabButtons, toast } from 'frappe-ui'
import type { Resource } from '@/types'
import { useScreenSize } from '@/utils/composables'
import { useStickyStackHeight } from '@/composables/useStickyStackHeight'
import { resourceErrorMessage, submitResource } from '@/utils/resource'
import type { StudentViewMode } from '@/composables/useStudentView'

/**
 * Student view controls. Enrolled gives the instructor a real enrollment of
 * their own, so lessons, quizzes and progress behave as for a learner.
 */
const props = defineProps<{
	doctype: 'LMS Course' | 'LMS Batch'
	name: string
}>()
const emit = defineEmits<{ exit: []; change: [] }>()
const mode = defineModel<StudentViewMode>({ required: true })

const showReset = ref(false)
const { isMobile } = useScreenSize()

// It wraps to two rows on phones, so its height is measured.
const bar = ref<HTMLElement | null>(null)
useStickyStackHeight(bar, '--student-view-bar-h')

const modes = [
	{
		label: __('Not enrolled'),
		value: 'not-enrolled',
		iconLeft: 'lucide-user-round',
	},
	{
		label: __('Enrolled'),
		value: 'enrolled',
		iconLeft: 'lucide-user-round-check',
	},
]

const resetMessage = computed(() =>
	props.doctype === 'LMS Batch'
		? __(
				'This deletes your completed lessons, quiz and assignment submissions in every course of this batch. Learners are not affected. This cannot be undone.'
		  )
		: __(
				'This deletes your completed lessons, quiz and assignment submissions in this course. Learners are not affected. This cannot be undone.'
		  )
)

const params = () => ({ doctype: props.doctype, name: props.name })

const enroll = createResource({
	url: 'lms.lms.student_view.enroll_self',
	makeParams: params,
}) as Resource<null>

const reset = createResource({
	url: 'lms.lms.student_view.reset_own_progress',
	makeParams: params,
}) as Resource<null>

function failed(error: unknown): void {
	toast.error(resourceErrorMessage(error))
}

// Waits for the name: a page arriving in enrolled mode may not have loaded
// its course yet, and enrolling into nothing fails back to not enrolled.
watch(
	[mode, () => props.name],
	([value, name]) => {
		if (value !== 'enrolled' || !name) return
		submitResource(
			enroll,
			{},
			{
				onSuccess: () => emit('change'),
				onError(error) {
					mode.value = 'not-enrolled'
					failed(error)
				},
			}
		)
	},
	{ immediate: true }
)

function resetProgress(): void {
	showReset.value = false
	submitResource(
		reset,
		{},
		{
			onSuccess() {
				toast.success(__('Your progress was reset'))
				emit('change')
			},
			onError: failed,
		}
	)
}
</script>
