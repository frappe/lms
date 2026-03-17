<template>
	<div class="mt-7">
		<h2 class="mb-3 text-lg font-semibold text-ink-gray-9">
			{{ __('Settings') }}
		</h2>
		<div
			v-if="readOnlyMode"
			class="flex items-center space-x-2 text-sm text-ink-gray-7 bg-surface-gray-1 px-3 py-2 rounded-md w-full text-center"
		>
			<CircleAlert class="size-4 stroke-1.5" />
			<span>
				{{ __('You cannot change the roles in read-only mode.') }}
			</span>
		</div>
		<div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
			<Switch
				size="sm"
				:label="__('Student')"
				:description="
					__('Can browse courses, enroll in batches, and view content.')
				"
				v-model="lms_student"
				@change="changeRole('lms_student')"
			/>
			<Switch
				size="sm"
				:label="__('Course Creator')"
				:description="
					__('Can create, edit, and manage courses, chapters, and lessons.')
				"
				v-model="course_creator"
				@change="changeRole('course_creator')"
			/>
			<Switch
				size="sm"
				:label="__('Evaluator')"
				:description="
					__('Can create batches/live classes and grade student assignments.')
				"
				v-model="batch_evaluator"
				@change="changeRole('batch_evaluator')"
			/>
			<Switch
				size="sm"
				:label="__('Moderator')"
				:description="
					__('Full access to all content, users, and system-wide settings.')
				"
				v-model="moderator"
				@change="changeRole('moderator')"
			/>
		</div>
	</div>
</template>
<script setup>
import { Switch, call, createResource, toast } from 'frappe-ui'
import { ref, watch } from 'vue'
import { convertToTitleCase } from '@/utils'
import { CircleAlert } from 'lucide-vue-next'

const moderator = ref(false)
const course_creator = ref(false)
const batch_evaluator = ref(false)
const lms_student = ref(false)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

const roles = createResource({
	url: 'lms.lms.utils.get_roles',
	makeParams(values) {
		return {
			name: values.member,
		}
	},
	onSuccess(data) {
		let roles = [
			'moderator',
			'course_creator',
			'batch_evaluator',
			'lms_student',
		]
		for (let role of roles) {
			if (data[role]) eval(role).value = true
		}
	},
})

watch(
	() => props.profile,
	(newValue) => {
		roles.reload({
			member: newValue.data?.name,
		})
	},
	{ immediate: true }
)

const updateRole = createResource({
	url: 'lms.lms.api.save_role',
	makeParams(values) {
		return {
			user: props.profile.data?.name,
			role: values.role,
			value: values.value,
		}
	},
})

// todo: use save_role for all roles to ensure consistent behavior and error handling
const changeRole = (role) => {
	const roleName =
		role == 'lms_student'
			? 'LMS Student'
			: convertToTitleCase(role.split('_').join(' '))
	const value = eval(role).value

	updateRole.submit(
		{
			role: roleName,
			value: value,
		},
		{
			async onSuccess() {
				if (role === 'batch_evaluator') {
					await syncEvaluatorRecord(value)
				}
				toast.success(__('Role updated successfully'))
			},
		}
	)
}
</script>
