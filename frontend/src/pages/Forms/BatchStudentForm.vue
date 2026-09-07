<template>
	<FormShell :title="__('Enroll a Student')" size="lg" @close="close">
		<template #default>
			<div v-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div
				v-else
				data-testid="batch-student-fields"
				class="flex flex-col gap-4"
			>
				<Link
					doctype="User"
					v-model="student"
					placeholder=" "
					:label="__('Student')"
					:required="true"
					:onCreate="openMemberSettings"
				/>
				<Link
					doctype="LMS Payment"
					v-model="payment"
					placeholder=" "
					:label="__('Payment')"
					:onCreate="openPaymentSettings"
				/>
			</div>
		</template>
		<template #actions>
			<HeaderButton
				v-if="!refusal"
				data-testid="batch-student-save"
				:label="__('Save')"
				variant="solid"
				:loading="enrollment.loading"
				@click="submit"
			/>
		</template>
	</FormShell>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import {
	createResource,
	getCachedListResource,
	getCachedResource,
	toast,
} from 'frappe-ui'
import { useOnboarding } from 'frappe-ui/frappe'
import { useRoute } from 'vue-router'
import { openSettings } from '@/utils'
import Link from '@/components/Controls/Link.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { batchRouteLocation } from '@/composables/useBatchForms'
import { useFormRoute } from '@/composables/useFormRoute'
import { submitResource } from '@/utils/resource'

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const user = inject('$user')
const route = useRoute()
const readOnlyMode = window.read_only_mode
const { updateOnboardingStep } = useOnboarding('learning')

const student = ref(null)
const payment = ref(null)

const { close, saveAndReplace } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

// Copied from BatchDetail.vue's isAdmin() gate on the Enroll button. A URL does
// not go through a button. Read-only was not on that button, but every other
// converted form checks it and a read-only site cannot insert.
//
// UX gate, not an authorization boundary — validate_owner() on LMS Batch
// Enrollment is, and it demands the same two roles.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!user.data?.is_moderator && !user.data?.is_evaluator) {
		return __('You do not have permission to enroll students in this batch.')
	}
	return ''
})

// This form's own insert. The modal reached the dashboard's list resource
// through `:students` and inserted into it; a routed page has no parent to
// receive that from, and a deep link has no dashboard tab mounted at all.
// A plain createResource rather than a list resource, so a save does not also
// fire frappe-ui's unfiltered follow-up list fetch.
const enrollment = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Batch Enrollment',
				member: student.value,
				payment: payment.value,
				batch: props.batchName,
			},
		}
	},
})

// The Overview overlay's Seats Left comes from get_batch_details, and enrolling
// is what moves it. That resource deliberately carries no cache key
// (useBatchForms.ts explains why one must never be added back), so it cannot be
// reached by key the way the two below are — BatchDetail hosts this form in its
// own <router-view> and hands the reload down instead.
const reloadBatchDetails = inject('reloadBatchDetails', null)

// Both live on the dashboard tab behind this form. Null on a deep link, where
// that tab was never mounted — correct, since each fetches on mount.
const reloadDashboard = () => {
	getCachedListResource(['batchStudents', props.batchName])?.reload()
	getCachedResource(['batch_student_count', props.batchName])?.reload()
	reloadBatchDetails?.()
}

// Link calls these with one argument unless it is in `inlineCreate` mode, which
// neither field is — it closes its own dropdown first, so there is no second
// close callback to invoke here.
//
// Leaving the form to open Settings is the modal's behaviour kept intact: the
// settings drawer would otherwise sit under a full-screen form on a phone.
const openMemberSettings = () => {
	if (openSettings('Members')) close()
}

const openPaymentSettings = () => {
	if (openSettings('Transactions')) close()
}

const submit = () => {
	if (refusal.value) return
	if (!student.value) {
		toast.error(__('Please select a student to enroll.'))
		return
	}
	submitResource(
		enrollment,
		{},
		{
			onSuccess() {
				if (user.data?.is_system_manager) {
					updateOnboardingStep('add_batch_student')
				}
				reloadDashboard()
				toast.success(__('Student enrolled successfully'))
				saveAndReplace(
					batchRouteLocation('BatchDetail', props.batchName, route.hash)
				)
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>
