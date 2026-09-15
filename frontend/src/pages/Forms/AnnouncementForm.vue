<template>
	<FormShell :title="__('Make an Announcement')" size="xl" @close="close">
		<template #default>
			<div v-if="loadingBatch" class="p-4 text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div v-else-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="announcement-fields">
				<FormLayout v-model:doc="doc" :layout="layout" />
			</div>
		</template>
		<template #actions>
			<div
				v-if="!refusal && !loadingBatch"
				class="flex items-center justify-end"
			>
				<HeaderButton
					data-testid="announcement-save"
					:label="__('Save')"
					variant="solid"
					:loading="announcementResource.loading"
					@click="makeAnnouncement()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup>
import { createResource, toast } from 'frappe-ui'
import { FormLayout, CommitKey, NO_COMMIT } from '@framework/ui/FormLayout'
import { computed, inject, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import RichTextEditorField from '@/components/FormLayout/RichTextEditorField.vue'
import {
	batchRouteLocation,
	useBatchDetails,
} from '@/composables/useBatchForms'
import { useFormRoute } from '@/composables/useFormRoute'
import { submitResource } from '@/utils/resource'

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

// A create dialog whose fields commit to nothing per field — the Save button
// reads `doc` and submits it whole, so there is no per-field script to run.
provide(CommitKey, NO_COMMIT)

const user = inject('$user')
const route = useRoute()
const readOnlyMode = window.read_only_mode

// C2: close()'s pop branch restores the hash by itself; its deep-link branch
// replaces to this literal location, so the tab hash has to be carried here or
// a close lands on the bare path and silently resets the page to tab 0.
const { close } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

// Parent context a URL cannot carry: the student list, used both as the BCC
// recipients and as the form's own precondition. Its own fetch, NOT the page's
// instance — see useBatchForms.ts for why sharing one is not available here.
//
// Nor is there a shared LIST cache key, unlike the create forms elsewhere in
// this cycle: this sends a Communication through frappe.core...email.make
// rather than inserting a row, so there is no list row for a shared instance
// to make appear. The Announcements tab reads its own resource and, exactly as
// before this conversion, is not refreshed by a send.
const batch = useBatchDetails(() => props.batchName)

const loadingBatch = computed(() => !batch.data && batch.loading)

const isAdmin = computed(() =>
	Boolean(user.data?.is_moderator || user.data?.is_evaluator)
)

// Lifted off BatchDetail.vue's "Make Announcement" button, which renders only
// for an admin outside read-only mode and disables itself with no students.
//
// UX gate, not an authorization boundary — the server-side permission check on
// Communication is.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!isAdmin.value)
		return __('You are not permitted to make an announcement for this batch.')
	if (!batch.data?.students?.length)
		return __('Add students to the batch to make an announcement')
	return null
})

// Uncontrolled by design-doc decision: the editor gets no :content binding, so a
// reloaded draft always starts empty. Accepted, out of scope for the conversion.
const doc = ref({
	subject: '',
	replyTo: '',
	announcement: '',
})

const layout = [
	{
		sections: [
			{
				columns: [
					{
						fields: [
							{
								fieldname: 'subject',
								fieldtype: 'Data',
								label: __('Subject'),
								reqd: true,
							},
							{
								fieldname: 'replyTo',
								fieldtype: 'Data',
								label: __('Reply To'),
								reqd: true,
							},
							{
								fieldname: 'announcement',
								fieldtype: 'Text Editor',
								label: __('Announcement'),
								reqd: true,
								ui: {
									component: RichTextEditorField,
									props: {
										fixedMenu: true,
										editorClass:
											'prose-sm py-2 px-2 min-h-[200px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-5 bg-surface-gray-3',
									},
								},
							},
						],
					},
				],
			},
		],
	},
]

const announcementResource = createResource({
	url: 'frappe.core.doctype.communication.email.make',
	makeParams() {
		return {
			recipients: doc.value.replyTo,
			bcc: (batch.data?.students || []).join(', '),
			subject: doc.value.subject,
			content: doc.value.announcement,
			doctype: 'LMS Batch',
			name: props.batchName,
			send_email: 1,
		}
	},
})

const makeAnnouncement = () => {
	if (refusal.value) return
	submitResource(
		announcementResource,
		{},
		{
			validate() {
				if (!batch.data?.students?.length) {
					return __('No students in this batch')
				}
				if (!doc.value.subject) {
					return __('Subject is required')
				}
				if (!doc.value.announcement) {
					return __('Announcement is required')
				}
				if (!doc.value.replyTo) {
					return __('Reply To is required')
				}
			},
			onSuccess() {
				close()
				toast.success(__('Announcement has been sent successfully'))
			},
			onError(err) {
				toast.error(__(err.messages?.[0] || err))
			},
		}
	)
}
</script>
