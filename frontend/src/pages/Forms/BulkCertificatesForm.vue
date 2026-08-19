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
					v-model="details.issue_date"
					:label="__('Issue Date')"
				/>
				<FormControl
					type="date"
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
					:label="__('Save')"
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
	Boolean(user.data?.is_moderator || user.data?.is_evaluator)
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
	if (!batch.data?.students?.length)
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

const createCertificate = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Certificate',
				issue_date: details.issue_date,
				expiry_date: details.expiry_date,
				template: details.template,
				published: details.published,
				course: values.course,
				batch_name: values.batch,
				member: values.member,
				evaluator: details.evaluator,
			},
		}
	},
})

const generating = ref(false)

// Design doc R4. The modal fired one insert per student without awaiting any
// of them, then closed and claimed success immediately — so a server-side
// failure arrived as a toast against a form that had already gone, and the
// user was told every certificate was created when none might have been.
// Routing made that worse, because closing now navigates.
//
// The requests still go out together (same load on the server as before); the
// difference is that the outcome is waited for. On any failure the form stays
// open, so the per-student error toasts land somewhere the user can act on.
const generateCertificates = async () => {
	if (refusal.value || generating.value) return
	generating.value = true
	let failed = 0
	try {
		// try/finally, not a bare await: frappe-ui's handleError RETHROWS after
		// running onError (resources.js:183), so one rejected insert rejects the
		// Promise.all and skips the reset below — leaving the Generate button
		// spinning and disabled with no way back but a reload.
		await Promise.all(
			(batch.data?.students || []).map((student) =>
				submitResource(
					createCertificate,
					{
						course: details.course,
						batch: props.batchName,
						member: student,
					},
					{
						onError(err) {
							failed += 1
							toast.error(
								resourceErrorMessage(err, __('Unable to generate certificate'))
							)
						},
					}
				)
			)
		)
	} finally {
		generating.value = false
	}
	if (failed) return
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
