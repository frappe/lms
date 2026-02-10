<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Enroll a Student'),
			size: 'lg',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => addStudent(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<Link
					doctype="User"
					v-model="student"
					:filters="{ ignore_user_type: 1 }"
					placeholder=" "
					:label="__('Student')"
					:onCreate="
						() => {
							openSettings('Members')
							show = false
						}
					"
					:required="true"
				/>
				<Link
					doctype="LMS Payment"
					v-model="payment"
					placeholder=" "
					:label="__('Payment')"
					:onCreate="
						() => {
							openSettings('Transactions')
							show = false
						}
					"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { call, Dialog, toast } from 'frappe-ui'
import { ref, inject } from 'vue'
import { useOnboarding } from 'frappe-ui/frappe'
import { openSettings } from '@/utils'
import Link from '@/components/Controls/Link.vue'

const student = ref(null)
const payment = ref(null)
const user = inject('$user')
const { updateOnboardingStep } = useOnboarding('learning')
const show = defineModel()

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
	students: {
		type: Object,
		default: null,
	},
})

const addStudent = (close) => {
	props.students.insert.submit(
		{
			member: student.value,
			payment: payment.value,
			batch: props.batch.data?.name,
		},
		{
			onSuccess() {
				if (user.data?.is_system_manager)
					updateOnboardingStep('add_batch_student')

				student.value = null
				payment.value = null
				props.batch.reload()
				close()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
				console.error(err)
			},
		}
	)
}
</script>
