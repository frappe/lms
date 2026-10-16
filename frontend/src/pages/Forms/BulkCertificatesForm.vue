<template>
	<FormShell :title="__('Generate Certificates')" size="lg" @close="close">
		<template #default>
			<div v-if="loadingBatch" class="p-4 text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div v-else-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="bulk-certificates-fields" class="space-y-4">
				<Link
					v-model="details.evaluator"
					:label="__('Evaluator')"
					doctype="Course Evaluator"
				/>
				<FormControl
					type="date"
					:format="dateFormat"
					v-model="details.issue_date"
					:label="__('Issue Date')"
				/>
				<FormControl
					type="date"
					:format="dateFormat"
					v-model="details.expiry_date"
					:label="__('Expiry Date')"
				/>
				<FormControl
					type="select"
					v-model="details.course"
					:label="__('Course')"
					:options="courseOptions"
				/>
				<Link
					v-model="details.template"
					:label="__('Template')"
					doctype="Print Format"
					:filters="{
						doc_type: 'LMS Certificate',
					}"
				/>
				<BooleanSwitch
					size="sm"
					:label="__('Published')"
					:description="
						__(
							'Enabling this will publish the certificate on the certified participants page.'
						)
					"
					v-model="details.published"
				/>
			</div>
		</template>
		<template #actions>
			<div
				v-if="!refusal && !loadingBatch"
				class="flex items-center justify-end"
			>
				<HeaderButton
					data-testid="bulk-certificates-save"
					:label="__('Generate')"
					variant="solid"
					:loading="generating"
					@click="generateCertificates()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { createResource, FormControl, toast } from 'frappe-ui'
import { useRoute } from 'vue-router'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import Link from '@/components/Controls/Link.vue'
import {
	batchRouteLocation,
	useBatchDetails,
} from '@/composables/useBatchForms'
import { useFormRoute } from '@/composables/useFormRoute'
import { resourceErrorMessage, submitResource } from '@/utils/resource'
import { getDateFormat } from '@/utils/format'

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const dayjs = inject('$dayjs')
const user = inject('$user')
const route = useRoute()
const readOnlyMode = window.read_only_mode
const dateFormat = getDateFormat()

// C2: close()'s pop branch restores the hash by itself; its deep-link branch
// replaces to this literal location, so the tab hash has to be carried here.
const { close } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

// Parent context a URL cannot carry: `students` (who we mint certificates for)
// and `courses` (the Course select). Its own fetch, NOT the page's instance —
// see useBatchForms.ts for why sharing one is not available here.
const batch = useBatchDetails(() => props.batchName)

const loadingBatch = computed(() => !batch.data && batch.loading)

const isAdmin = computed(() =>
	Boolean(
		user.data?.is_moderator || user.data?.is_evaluator || batch.data?.can_manage
	)
)

// Lifted off the opener in BatchDetail.vue — "Generate Certificates" only
// exists inside a Dropdown gated on `isAdmin`, and only when the batch is a
// certification batch. A URL goes through none of that.
//
// This is a UX gate, not an authorization boundary: Frappe's server-side
// DocPerms on `LMS Certificate` are what actually stop an unentitled insert.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!isAdmin.value)
		return __('You are not permitted to generate certificates for this batch.')
	if (!batch.data?.certification)
		return __('Certificates are not enabled for this batch.')
	if (!batch.data?.student_count)
		return __('This batch has no students to certify.')
	return null
})

const details = reactive({
	issue_date: dayjs().format('YYYY-MM-DD'),
	expiry_date: null,
	template: null,
	evaluator: null,
	published: true,
	course: null,
})

// The server certifies each student under the caller's own permissions, so this
// form never holds their addresses. On any failure the form stays open, so the
// toasts land where the user can act on them.
const createCertificates = createResource({
	url: 'lms.lms.api.generate_batch_certificates',
	makeParams() {
		return {
			batch: props.batchName,
			details: {
				issue_date: details.issue_date,
				expiry_date: details.expiry_date,
				template: details.template,
				published: details.published,
				course: details.course,
				evaluator: details.evaluator,
			},
		}
	},
})

const generating = ref(false)

const generateCertificates = async () => {
	if (refusal.value || generating.value) return
	generating.value = true
	let errors = []
	let failed = false
	try {
		await submitResource(
			createCertificates,
			{},
			{
				onSuccess(result) {
					errors = result?.errors || []
				},
				onError(err) {
					failed = true
					toast.error(
						resourceErrorMessage(err, __('Unable to generate certificate'))
					)
				},
			}
		)
	} finally {
		generating.value = false
	}
	errors.forEach((message) => toast.error(message))
	if (failed || errors.length) return
	toast.success(__('Certificates generated successfully'))
	close()
}

const courseOptions = computed(() =>
	(batch.data?.courses || []).map((course) => ({
		label: course.course,
		value: course.course,
	}))
)
</script>
