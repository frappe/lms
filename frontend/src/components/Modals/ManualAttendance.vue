<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Mark Attendance - {0}').format(live_class?.title),
			size: '2xl',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick: () => saveAttendance(),
				},
			],
		}"
	>
		<template #body-content>
			<div v-if="enrollments.data?.length" class="divide-y">
				<label
					v-for="student in enrollments.data"
					:key="student.member"
					class="flex items-center space-x-3 py-2 cursor-pointer hover:bg-surface-gray-2 px-2 rounded"
				>
					<input
						type="checkbox"
						:value="student.member"
						v-model="selectedMembers"
						class="rounded border-outline-gray-3"
					/>
					<Avatar
						:image="student.member_image"
						:label="student.member_name"
						size="lg"
					/>
					<div>
						<div class="font-medium text-ink-gray-9">
							{{ student.member_name }}
						</div>
						<div class="text-sm text-ink-gray-5">
							{{ student.member }}
						</div>
					</div>
				</label>
			</div>
			<div v-else class="text-sm text-ink-gray-5 italic py-4">
				{{ __('No students enrolled in this batch.') }}
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Avatar, createListResource, createResource, Dialog, toast } from 'frappe-ui'
import { ref, onMounted } from 'vue'

const show = defineModel()
const emit = defineEmits(['saved'])

const props = defineProps({
	live_class: {
		type: Object,
		required: true,
	},
	batch: {
		type: String,
		required: true,
	},
})

const selectedMembers = ref([])

const enrollments = createListResource({
	doctype: 'LMS Batch Enrollment',
	filters: {
		batch: props.batch,
	},
	fields: ['member', 'member_name', 'member_image'],
	auto: true,
})

const existingAttendance = createListResource({
	doctype: 'LMS Live Class Participant',
	filters: {
		live_class: props.live_class?.name,
	},
	fields: ['member'],
	auto: true,
	onSuccess(data) {
		selectedMembers.value = data.map((d) => d.member)
	},
})

const markAttendance = createResource({
	url: 'lms.lms.doctype.lms_live_class.lms_live_class.mark_manual_attendance',
})

const saveAttendance = () => {
	markAttendance.submit(
		{
			live_class: props.live_class?.name,
			members: JSON.stringify(selectedMembers.value),
		},
		{
			onSuccess() {
				toast.success(__('Attendance saved successfully'))
				emit('saved')
				show.value = false
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>
