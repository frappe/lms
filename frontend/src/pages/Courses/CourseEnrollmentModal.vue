<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Enroll a Student'),
			size: 'xl',
		}"
	>
		<template #body-content>
			<div class="space-y-4">
				<FormControl
					type="checkbox"
					:label="__('Purchased Certificate')"
					v-model="purchasedCertificate"
				/>
				<Link
					doctype="User"
					:label="__('Student')"
					placeholder=" "
					v-model="student"
					:required="true"
					:onCreate="
						() => {
							openSettings('Members')
							show = false
						}
					"
				/>
				<Link
					v-if="purchasedCertificate"
					doctype="LMS Payment"
					:label="__('Payment')"
					placeholder=" "
					v-model="payment"
					:onCreate="
						() => {
							openSettings('Transactions')
							show = false
						}
					"
				/>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="text-right">
				<Button variant="solid" @click="enrollStudent(close)">
					{{ __('Enroll') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, call, Dialog, FormControl, toast } from 'frappe-ui'
import { ref } from 'vue'
import { openSettings } from '@/utils'
import Link from '@/components/Controls/Link.vue'

const show = defineModel<boolean>({ required: true, default: false })
const student = ref<string | null>(null)
const students = defineModel<any[]>('students')
const payment = ref<string | null>(null)
const purchasedCertificate = ref<boolean>(false)

const props = defineProps<{
	course: any
}>()

const enrollStudent = (close: () => void) => {
	let validationPassed = validateData()
	if (!validationPassed) return

	call('frappe.client.insert', {
		doc: {
			doctype: 'LMS Enrollment',
			course: props.course.data?.name,
			member: student.value,
			payment: purchasedCertificate.value ? payment.value : null,
			purchased_certificate: purchasedCertificate.value,
		},
	})
		.then(() => {
			students.value?.reload()
			toast.success(__('Student enrolled successfully'))
			close()
		})
		.catch((err: any) => {
			toast.error(__(err.messages?.[0] || err))
			console.error(err)
		})
}

const validateData = (): boolean => {
	if (!student.value) {
		toast.error(__('Please select a student to enroll.'))
		return false
	}
	if (purchasedCertificate.value && !payment.value) {
		toast.error(__('Please select a payment for the purchased certificate.'))
		return false
	}
	return true
}
</script>
