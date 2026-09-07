<template>
	<FormShell :title="__('Add an assessment')" size="sm" @close="close">
		<template #default>
			<div v-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="assessment-fields" class="space-y-4">
				<FormControl
					type="select"
					:options="assessmentTypes"
					v-model="assessmentType"
					:label="__('Type')"
					placeholder=" "
					@update:modelValue="() => (assessment = null)"
				/>
				<Link
					v-if="assessmentType"
					v-model="assessment"
					:doctype="assessmentType"
					:label="__('Assessment')"
					placeholder=" "
					:onCreate="createAssessment"
				/>
			</div>
		</template>
		<template #actions>
			<HeaderButton
				v-if="!refusal"
				:label="__('Save')"
				variant="solid"
				:loading="assessmentResource.loading"
				@click="submit"
			/>
		</template>
	</FormShell>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import {
	FormControl,
	createResource,
	getCachedResource,
	toast,
} from 'frappe-ui'
import { useRoute, useRouter } from 'vue-router'
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
const router = useRouter()
const readOnlyMode = window.read_only_mode

const assessmentType = ref(null)
const assessment = ref(null)

const { close, saveAndReplace } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

// Copied from Assessments.vue's canAddAssessments() gate on the Add button. A
// URL does not go through a button.
//
// UX gate, not an authorization boundary — the server-side permission check on
// LMS Assessment is.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		return __('You do not have permission to add assessments to this batch.')
	}
	return ''
})

const assessmentTypes = computed(() => [
	{ label: 'Quiz', value: 'LMS Quiz' },
	{ label: 'Assignment', value: 'LMS Assignment' },
	{ label: 'Programming Exercise', value: 'LMS Programming Exercise' },
])

const assessmentResource = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Assessment',
				parent: props.batchName,
				parenttype: 'LMS Batch',
				parentfield: 'assessment',
				assessment_type: assessmentType.value,
				assessment_name: assessment.value,
			},
		}
	},
})

// The list this page inserted into lives on the tab behind it. Null on a deep
// link, where that tab was never mounted — correct, since it fetches on mount.
const reloadAssessments = () => {
	getCachedResource(['batchAssessments', props.batchName])?.reload()
}

// Creating the underlying quiz or assignment is a different page, so leave the
// form rather than stack a second one on top of it.
// Link calls this with one argument unless it is in `inlineCreate` mode, which
// this field is not — it closes its own dropdown first, so there is no second
// close callback to invoke here.
const createAssessment = () => {
	if (assessmentType.value === 'LMS Quiz') {
		router.push({ name: 'QuizForm', params: { quizID: 'new' } })
	} else if (assessmentType.value === 'LMS Assignment') {
		router.push({ name: 'Assignments' })
	} else if (assessmentType.value === 'LMS Programming Exercise') {
		// The third type the picker offers had no branch, so Link closed its
		// dropdown and nothing else happened — a dead control on a form that
		// advertises the option.
		router.push({
			name: 'ProgrammingExerciseForm',
			params: { exerciseID: 'new' },
		})
	}
}

const submit = () => {
	if (refusal.value) return
	submitResource(
		assessmentResource,
		{},
		{
			onSuccess() {
				reloadAssessments()
				toast.success(__('Assessment added successfully'))
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
