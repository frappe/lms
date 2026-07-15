<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('New Address'),
			size: 'xl',
			actions: [
				{
					label: __('Create'),
					variant: 'solid',
					onClick: ({ close }) => createAddress(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="grid grid-cols-2 gap-5">
				<FormControl
					v-model="address.address_title"
					:label="__('Address Title')"
					type="text"
					:required="true"
				/>
				<Select
					v-model="address.address_type"
					:label="__('Address Type')"
					:options="addressTypeOptions"
					:required="true"
					class="w-full"
				/>
				<FormControl
					v-model="address.address_line1"
					:label="__('Address Line 1')"
					type="text"
					:required="true"
				/>
				<FormControl
					v-model="address.address_line2"
					:label="__('Address Line 2')"
					type="text"
				/>
				<FormControl
					v-model="address.city"
					:label="__('City')"
					type="text"
					:required="true"
				/>
				<FormControl
					v-model="address.state"
					:label="__('State/Province')"
					type="text"
				/>
				<Link
					v-model="address.country"
					:label="__('Country')"
					doctype="Country"
					:required="true"
				/>
				<FormControl
					v-model="address.pincode"
					:label="__('Postal Code')"
					type="text"
				/>
				<FormControl
					v-model="address.phone"
					:label="__('Phone Number')"
					type="text"
				/>
				<FormControl
					v-model="address.email_id"
					:label="__('Email Address')"
					type="text"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { call, Dialog, FormControl, Select, toast } from 'frappe-ui'
import { reactive, watch } from 'vue'
import Link from '@/components/Controls/Link.vue'

interface Address {
	address_title: string
	address_type: string
	address_line1: string
	address_line2: string
	city: string
	state: string
	country: string
	pincode: string
	phone: string
	email_id: string
}

const show = defineModel<boolean>('show')

const emit = defineEmits<{
	(e: 'created', name: string): void
}>()

const addressTypeOptions = [
	'Billing',
	'Shipping',
	'Office',
	'Personal',
	'Postal',
	'Other',
]

const emptyAddress = (): Address => ({
	address_title: '',
	address_type: 'Billing',
	address_line1: '',
	address_line2: '',
	city: '',
	state: '',
	country: '',
	pincode: '',
	phone: '',
	email_id: '',
})

const address = reactive<Address>(emptyAddress())

watch(show, (isOpen) => {
	if (isOpen) Object.assign(address, emptyAddress())
})

const createAddress = (close: () => void) => {
	const missing = (
		['address_title', 'address_line1', 'city', 'country'] as const
	).find((field) => !address[field]?.trim())
	if (missing) {
		toast.error(
			__('Address Title, Address Line 1, City and Country are required.')
		)
		return
	}
	call('frappe.client.insert', {
		doc: {
			doctype: 'Address',
			...address,
		},
	})
		.then((doc: { name: string }) => {
			emit('created', doc.name)
			close()
			toast.success(__('Address created successfully'))
		})
		.catch((err: { messages?: string[] }) => {
			toast.error(err.messages?.[0] || __('Error creating Address'))
			console.error(err)
		})
}
</script>
