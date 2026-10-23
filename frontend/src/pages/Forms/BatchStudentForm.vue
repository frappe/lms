<template>
	<EnrollStudentsForm
		:target="target"
		:refusal="refusal"
		:loading="loadingBatch"
		@close="close"
		@enrolled="onEnrolled"
	/>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { getCachedListResource, getCachedResource } from 'frappe-ui'
import { useOnboarding } from '@framework/ui/components/Onboarding/index'
import { seesOnboarding } from '@/utils/onboarding'
import { useRoute } from 'vue-router'
import EnrollStudentsForm from '@/components/Enrollment/EnrollStudentsForm.vue'
import { paidKindForBatch } from '@/components/Enrollment/enrollment'
import {
	batchRouteLocation,
	useBatchDetails,
} from '@/composables/useBatchForms'
import { useFormRoute } from '@/composables/useFormRoute'
import type { BulkEnrollResult, EnrollTarget, SessionUser } from '@/types'

const props = defineProps<{
	batchName: string
}>()

const user = inject<SessionUser>('$user')!
const route = useRoute()
const readOnlyMode = (window as Window & { read_only_mode?: boolean })
	.read_only_mode
const { updateOnboardingStep } = useOnboarding('learning')
const batch = useBatchDetails(() => props.batchName)

const { close } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

const loadingBatch = computed(() => !batch.data && batch.loading)

// Copied from BatchDetail.vue's isAdmin() gate on the Enroll button. A URL does
// not go through a button. Read-only was not on that button, but every other
// converted form checks it and a read-only site cannot insert.
//
// UX gate, not an authorization boundary — validate_owner() on LMS Batch
// Enrollment is, and it now also passes a tagged Course Creator via can_author_batch.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (
		!user.data?.is_moderator &&
		!user.data?.is_evaluator &&
		!batch.data?.can_manage
	) {
		return __('You do not have permission to enroll students in this batch.')
	}
	return ''
})

const target = computed<EnrollTarget | null>(() => {
	if (!batch.data) return null
	return {
		doctype: 'LMS Batch',
		name: props.batchName,
		paidKind: paidKindForBatch(batch.data),
		priceLabel: batch.data.price ?? null,
	}
})

// The Overview overlay's Seats Left comes from get_batch_details, and enrolling
// is what moves it. That resource deliberately carries no cache key
// (useBatchForms.ts explains why one must never be added back), so it cannot be
// reached by key the way the two below are — BatchDetail hosts this form in its
// own <router-view> and hands the reload down instead.
const reloadBatchDetails = inject<(() => void) | null>(
	'reloadBatchDetails',
	null
)

// Both live on the dashboard tab behind this form. Null on a deep link, where
// that tab was never mounted — correct, since each fetches on mount.
const reloadDashboard = () => {
	getCachedListResource(['batchStudents', props.batchName])?.reload()
	getCachedResource(['batch_student_count', props.batchName])?.reload()
	reloadBatchDetails?.()
}

const onEnrolled = (result: BulkEnrollResult) => {
	reloadDashboard()
	if (!result.added.length) return
	if (seesOnboarding(user.data)) updateOnboardingStep('add_batch_student')
}
</script>
