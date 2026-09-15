<template>
	<FormShell :title="__('Add a course to the batch')" size="lg" @close="close">
		<template #default>
			<div v-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="batch-course-fields" class="flex flex-col gap-4">
				<Link
					doctype="LMS Course"
					v-model="course"
					:label="__('Course')"
					:required="true"
					:filters="{ published: 1 }"
					variant="outline"
					:onCreate="openNewCourse"
				/>
				<Link
					doctype="Course Evaluator"
					v-model="evaluator"
					:label="__('Evaluator')"
				/>
			</div>
		</template>
		<template #actions>
			<HeaderButton
				v-if="!refusal"
				:label="__('Save')"
				variant="solid"
				:loading="batchCourses.insert.loading"
				@click="submit"
			/>
		</template>
	</FormShell>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { createListResource, getCachedListResource, toast } from 'frappe-ui'
import { useOnboarding } from 'frappe-ui/frappe'
import { useRoute, useRouter } from 'vue-router'
import Link from '@/components/Controls/Link.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { batchRouteLocation } from '@/composables/useBatchForms'
import { useFormRoute } from '@/composables/useFormRoute'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const user = inject('$user')
const route = useRoute()
const router = useRouter()
const readOnlyMode = window.read_only_mode
const { updateOnboardingStep } = useOnboarding('learning')

const course = ref(null)
const evaluator = ref(null)

// The tab hash is carried through close(), same as the other batch forms: a
// close that dropped it lands on the bare path and resets the page to tab 0.
const { close, saveAndReplace } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

// Copied from BatchCourses.vue's `isAdmin()` gate on the Add button. A URL does
// not go through a button, so the page has to say no by itself.
//
// UX gate, not an authorization boundary — the server-side permission check on
// Batch Course is.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		return __('You do not have permission to add courses to this batch.')
	}
	return ''
})

// This form's own insert resource. BatchCourses.vue used to hand its list down
// through `v-model:courses`; a routed page has no parent to receive it from,
// and a deep link has no parent mounted at all.
const batchCourses = createListResource({
	doctype: 'Batch Course',
	parent: 'LMS Batch',
})

// The list this page inserted into lives on the tab behind it. Null when that
// tab is not mounted (a deep link), which is correct — it fetches on mount
// anyway. Mirrors LiveClassForm.vue's reloadLiveClassList().
const reloadBatchCourses = () => {
	getCachedListResource(['batchCourses', props.batchName])?.reload()
}

// Link calls this with one argument unless it is in `inlineCreate` mode, which
// this field is not — it closes its own dropdown first, so there is no second
// close callback to invoke here.
const openNewCourse = () => {
	router.push({ name: 'NewCourse' })
}

// submitResource, not a bare submit(): createResource rethrows after onError, so
// the rejection would be unhandled, and a throw from onSuccess (updateOnboarding
// Step, when onboarding is not registered) would be toasted as a failed request
// even though the row was inserted.
const submit = () => {
	if (refusal.value) return
	return submitResource(
		batchCourses.insert,
		{
			course: course.value,
			evaluator: evaluator.value,
			parent: props.batchName,
			parenttype: 'LMS Batch',
			parentfield: 'courses',
		},
		{
			onSuccess() {
				if (user.data?.is_system_manager) {
					updateOnboardingStep('add_batch_course')
				}
				reloadBatchCourses()
				toast.success(__('Course added to batch successfully'))
				saveAndReplace(
					batchRouteLocation('BatchDetail', props.batchName, route.hash)
				)
			},
			onError(err) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)
}
</script>
