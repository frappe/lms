<template>
	<div class="flex min-h-full flex-col">
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #status>
				<Badge theme="amber">{{ __('Draft') }}</Badge>
			</template>
			<template #actions>
				<DraftPageActions
					v-if="canCreate"
					:saveFirst="__('Save the batch first')"
				>
					<BatchSaveButton :form="form" />
				</DraftPageActions>
			</template>
		</PageHeader>
		<p v-if="!canCreate" class="p-5 text-p-base text-ink-gray-6">
			{{ __('You are not permitted to create a batch.') }}
		</p>
		<template v-else>
			<DraftBanner
				:title="__('This is your batch page')"
				:description="
					__(
						'Learners see it like this. Fill in the grey placeholders, then save. Classes, announcements and the dashboard open after the first save.'
					)
				"
			/>
			<BatchOverview :batch="batch" />
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, usePageMeta } from 'frappe-ui'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { useTelemetry } from '@framework/ui/telemetry/index'
import DraftBanner from '@/components/InlineEdit/DraftBanner.vue'
import DraftPageActions from '@/components/InlineEdit/DraftPageActions.vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import BatchOverview from '@/pages/Batches/BatchOverview.vue'
import BatchSaveButton from '@/pages/Batches/components/BatchSaveButton.vue'
import { useBatchDraft } from '@/pages/Batches/composables/useBatchDraft'
import { filledFields, takeFormSource } from '@/composables/formTracking'
import {
	saveShortcut,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { seesOnboarding } from '@/utils/onboarding'
import type { BatchDetails, Resource, SessionUser } from '@/types'

const router = useRouter()
const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')
let created = false
// Set while Save and leave creates the batch, so it goes where the user was headed.
let isLeaving = false

const canCreate = computed<boolean>(() => {
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode) {
		return false
	}
	return Boolean(
		user.data?.is_moderator ||
			user.data?.is_instructor ||
			user.data?.is_evaluator
	)
})

const form = useBatchDraft(onCreated)

function onCreated(name: string): void {
	created = true
	if (seesOnboarding(user.data)) updateOnboardingStep('create_first_batch')
	if (isLeaving) return
	router.replace({
		name: 'BatchDetail',
		params: { batchName: name },
		hash: '#overview',
	})
}

useUnsavedChangesGuard({
	isDirty: () => form.hasEdits.value,
	isSaving: () => form.isSaving.value,
	save: async () => {
		isLeaving = true
		try {
			return await form.submitBatch()
		} finally {
			isLeaving = false
		}
	},
})

const title = computed<string>(() => form.doc.value?.title?.trim() || '')

const batch = reactive({
	data: computed(
		() =>
			({
				...form.doc.value,
				name: '',
				title: title.value,
				instructors: [],
				student_count: 0,
				can_change_instructors: true,
			} as unknown as BatchDetails)
	),
}) as unknown as Resource<BatchDetails>

const breadcrumbs = computed(() => [
	{ label: __('Batches'), route: { name: 'Batches' } },
	...(title.value ? [{ label: title.value, route: { name: 'NewBatch' } }] : []),
])

useKeyboardShortcuts({
	active: () => canCreate.value,
	ignoreTyping: false,
	shortcuts: [saveShortcut(() => form.submitBatch())],
})

usePageMeta(() => ({ title: title.value || __('New batch') }))

onMounted(() => capture('batch_form_opened', { source: takeFormSource() }))
onBeforeUnmount(() => {
	if (created) return
	const doc = form.doc.value as unknown as Record<string, unknown>
	capture('batch_form_closed', { data: doc, filled_fields: filledFields(doc) })
})
</script>
