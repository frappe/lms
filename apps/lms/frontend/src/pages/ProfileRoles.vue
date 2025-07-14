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
		<div
			v-else
			class="flex flex-col md:flex-row gap-4 md:gap-0 justify-between w-3/4 mt-5"
		>
			<FormControl
				:label="__('Moderator')"
				v-model="moderator"
				type="checkbox"
				@change.stop="changeRole('moderator')"
			/>
			<FormControl
				:label="__('Course Creator')"
				v-model="course_creator"
				type="checkbox"
				@change.stop="changeRole('course_creator')"
			/>
			<FormControl
				:label="__('Evaluator')"
				v-model="batch_evaluator"
				type="checkbox"
				@change.stop="changeRole('batch_evaluator')"
			/>
			<FormControl
				:label="__('Student')"
				v-model="lms_student"
				type="checkbox"
				@change.stop="changeRole('lms_student')"
			/>
		</div>
	</div>
</template>
<script setup>
import { FormControl, createResource, toast } from 'frappe-ui'
import { ref } from 'vue'
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
			name: props.profile.data?.name,
		}
	},
	auto: true,
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

const changeRole = (role) => {
	updateRole.submit(
		{
			role: convertToTitleCase(role.split('_').join(' ')),
			value: eval(role).value,
		},
		{
			onSuccess(data) {
				toast.success(__('Role updated successfully'))
			},
		}
	)
}
</script>
