<template>
	<FormShell :title="formTitle" size="lg" @close="close">
		<template #default>
			<div v-if="!canManageAssignments" class="p-4 text-base text-ink-gray-6">
				{{ __('You are not permitted to manage assignments.') }}
			</div>
			<div v-else data-testid="assignment-fields" class="space-y-4 text-base">
				<FormControl
					v-model="assignment.title"
					:label="__('Title')"
					:required="true"
				/>
				<FormControl
					v-model="assignment.type"
					type="select"
					:options="assignmentOptions"
					:label="__('Submission Type')"
					:required="true"
				/>
				<Link
					v-model="assignment.course"
					:label="__('Course')"
					doctype="LMS Course"
					placeholder=" "
				/>
				<div
					role="group"
					:aria-labelledby="questionLabelId"
					class="space-y-1.5"
				>
					<InputLabel
						:id="questionLabelId"
						data-testid="assignment-question-label"
						:label="__('Question')"
						:required="true"
					/>
					<RichTextEditor
						:content="assignment.question"
						@change="(val: string) => (assignment.question = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[10rem] max-h-[18rem] overflow-y-auto"
					/>
				</div>
			</div>
		</template>
		<template #actions>
			<div
				v-if="canManageAssignments"
				class="flex items-center justify-end gap-2"
			>
				<router-link
					v-if="assignmentID !== 'new'"
					:to="{
						name: 'AssignmentSubmissionList',
						query: { assignmentID: assignmentID },
					}"
				>
					<HeaderButton
						:label="__('Check Submissions')"
						icon="lucide-clipboard-list"
					/>
				</router-link>
				<HeaderButton
					data-testid="assignment-save"
					:label="__('Save')"
					variant="solid"
					:loading="saving"
					@click="saveAssignment"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import {
	FormControl,
	createDocumentResource,
	createResource,
	toast,
} from 'frappe-ui'
import { computed, inject, reactive, useId, watch } from 'vue'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import Link from '@/components/Controls/Link.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { InputLabel } from '@/components/Form/labeling'
import { submitResource } from '@/utils/resource'

const questionLabelId = useId()

const props = withDefaults(defineProps<{ assignmentID?: string }>(), {
	assignmentID: 'new',
})

// The list page owns the count and the filtered query, so it — not this form —
// decides how to refetch after a create. See the comment on `newAssignment` for
// why this is a signal rather than a shared list resource.
const emit = defineEmits<{ created: [] }>()

const user = inject<any>('$user')
const { close, saveAndReplace } = useFormRoute({ name: 'Assignments' })

const isNew = computed(() => props.assignmentID === 'new')

const formTitle = computed(() =>
	isNew.value ? __('Create an Assignment') : __('Edit Assignment')
)

// Copied off the two places Assignments.vue gates this form today: the page
// guard at :104-106 (moderators and instructors only) and `readOnlyMode`, which
// hides the Create button (:19) and swallows the row click (:178). A URL goes
// through neither. This is a UX gate, not an authorization boundary — the
// server-side DocPerms on LMS Assignment are.
const canManageAssignments = computed<boolean>(() => {
	// Cast because Window carries no read_only_mode declaration; same shape as
	// NewBatchForm.vue:190.
	if ((window as Window & { read_only_mode?: boolean }).read_only_mode)
		return false
	return Boolean(user.data?.is_moderator || user.data?.is_instructor)
})

interface AssignmentFields {
	title: string
	type: string
	question: string
	course: string
}

const assignment = reactive<AssignmentFields>({
	title: '',
	type: '',
	question: '',
	course: '',
})

// C4: edit mode used to copy its values out of the parent list's in-memory
// array, which is empty when someone lands here by link or reload — the form
// then rendered blank and a Save would have written those blanks back. Fetch
// the record ourselves instead, the same way JobForm.vue:182-190 does.
// createDocumentResource returns undefined when `name` is falsy
// (documentResource.js:15), so in create mode there is simply no resource.
const editingName =
	props.assignmentID !== 'new' ? props.assignmentID : undefined
const assignmentDoc = createDocumentResource({
	doctype: 'LMS Assignment',
	// frappe-ui types `name` as required even though documentResource.js:15
	// returns undefined for a falsy one — which is the create-mode contract
	// JobForm.vue:184 already relies on. Cast rather than invent a name.
	name: editingName as string,
	auto: Boolean(editingName),
	onError(err: any) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

// C3: the watch this replaces had no `immediate`, so a directly mounted route
// never ran its load at all. It is still needed here alongside `auto`, because
// documentResource hands back a cached instance for a record already visited
// this session, whose `doc` is populated before this watcher is registered.
watch(
	() => assignmentDoc?.doc,
	(doc: any) => {
		if (!doc) return
		assignment.title = doc.title
		assignment.type = doc.type
		assignment.question = doc.question
		assignment.course = doc.course || ''
	},
	{ immediate: true }
)

// Deliberately NOT the parent list's cache key, unlike NewBatchForm.vue:178.
// Assignments.vue:148-162 configures its list through CONSTRUCTOR options
// (fields, orderBy, transform) and createListResource discards the second
// caller's options for an identical key (listResource.js:15-22) — so on a cold
// deep link this form would create the instance first and strip the list of its
// field list and its date formatting. Design C4b says to check that per page
// and to signal the parent explicitly where sharing is unsafe; this is that
// case, hence the `created` emit below.
const newAssignment = createResource({
	url: 'frappe.client.insert',
	makeParams: () => ({
		doc: { doctype: 'LMS Assignment', ...assignment },
	}),
	onSuccess() {
		toast.success(__('Assignment created successfully'))
		emit('created')
		// replace, not push: the form entry is consumed so Back reaches the list
		// rather than a stale, already-saved form.
		saveAndReplace({ name: 'Assignments' })
	},
	onError(err: any) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

const saving = computed<boolean>(() =>
	Boolean(newAssignment.loading || assignmentDoc?.setValue?.loading)
)

const validateFields = (): void => {
	assignment.title = sanitizeOnWrite(assignment.title.trim())
	assignment.question = sanitizeOnWrite(assignment.question)
}

const updateAssignment = (): void => {
	// setValue's beforeSubmit merges into `doc`, so it cannot run before the
	// fetch lands — documentResource.js:46-51 would Object.assign onto null.
	if (!assignmentDoc?.doc) return
	submitResource(
		assignmentDoc.setValue,
		{ ...assignment },
		{
			onSuccess() {
				toast.success(__('Assignment updated successfully'))
				// The edited row reaches the list on its own: setValue patches it
				// in every registered list resource for the doctype
				// (documentResource.js:50). Only a create needs the signal above.
				saveAndReplace({ name: 'Assignments' })
			},
			onError(err: any) {
				toast.error(err.messages?.[0] || err)
				console.error(err)
			},
		}
	)
}

const saveAssignment = (): void => {
	if (!canManageAssignments.value) return
	validateFields()
	if (isNew.value) newAssignment.submit()
	else updateAssignment()
}

const assignmentOptions = computed(() => {
	return [
		{ label: 'PDF', value: 'PDF' },
		{ label: 'Image', value: 'Image' },
		{ label: 'Document', value: 'Document' },
		{ label: 'Text', value: 'Text' },
		{ label: 'URL', value: 'URL' },
	]
})
</script>
