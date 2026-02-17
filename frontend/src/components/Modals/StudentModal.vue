<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Enroll a Student'),
			size: 'sm',
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

const students = defineModel('reloadStudents')
const batchModal = defineModel('batchModal')
const student = ref(null)
const payment = ref(null)
const user = inject('$user')
const { updateOnboardingStep } = useOnboarding('learning')
const show = defineModel()

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const addStudent = (close) => {
	call('frappe.client.insert', {
		doc: {
			doctype: 'LMS Batch Enrollment',
			batch: props.batch,
			member: student.value,
			payment: payment.value,
		},
	})
		.then(() => {
			if (user.data?.is_system_manager)
				updateOnboardingStep('add_batch_student')

			students.value.reload()
			batchModal.value.reload()
			student.value = null
			payment.value = null
			close()
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}
</script>
