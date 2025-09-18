<template>
	<Dialog
		v-model="show"
		:options="{
			title:
				gatewayID === 'new'
					? __('New Payment Gateway')
					: __('Edit Payment Gateway'),
			size: '3xl',
		}"
	>
		<template #body-content>
			<SettingFields
				v-if="gatewayID != 'new'"
				:fields="paymentGateway.data.fields"
				:data="paymentGateway.data.data"
				class="pt-5 my-0"
			/>
			<div v-else>
				<FormControl
					v-model="newGateway"
					:label="__('Select Payment Gateway')"
					type="select"
					:options="allGatewayOptions"
					:required="true"
				/>
				<SettingFields
					v-if="newGateway"
					:fields="newGatewayFields"
					:data="null"
					class="pt-5 my-0"
				/>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="pb-5 float-right">
				<Button variant="solid" @click="saveSettings(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Button,
	call,
	createListResource,
	createResource,
	Dialog,
	FormControl,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import SettingFields from '@/components/Settings/SettingFields.vue'

const show = defineModel()
const paymentGateways = defineModel<any>('paymentGateways')
const newGateway = ref(null)

const props = defineProps<{
	gatewayID: string | null
}>()

const paymentGateway = createResource({
	url: 'lms.lms.api.get_payment_gateway_details',
	makeParams(values: any) {
		return {
			payment_gateway: props.gatewayID,
		}
	},
	transform(data: any) {
		arrangeFields(data.fields)
		return data
	},
})

const allGateways = createListResource({
	doctype: 'DocType',
	filters: {
		module: 'Payment Gateways',
	},
	fields: ['name', 'issingle', 'fields'],
})

const arrangeFields = (fields: any[]) => {
	fields = fields.sort((a, b) => {
		if (a.type === 'Upload' && b.type !== 'Upload') {
			return 1
		} else if (a.type !== 'Upload' && b.type === 'Upload') {
			return -1
		}
		return 0
	})

	fields.splice(3, 0, {
		type: 'Column Break',
	})
}

watch(
	() => props.gatewayID,
	() => {
		if (props.gatewayID && props.gatewayID !== 'new') {
			paymentGateway.reload()
		} else if (props.gatewayID == 'new') {
			allGateways.reload()
			console.log(allGateways.data)
		}
	}
)

const saveSettings = (close: () => void) => {
	call('frappe.client.set_value', {
		doctype: paymentGateway.data.doctype,
		name: paymentGateway.data.docname,
		fieldname: Object.keys(paymentGateway.data.data).reduce(
			(fields: any, key: string) => {
				if (
					paymentGateway.data.data[key] &&
					typeof paymentGateway.data.data[key] === 'object'
				) {
					fields[key] = paymentGateway.data.data[key].file_url
				} else {
					fields[key] = paymentGateway.data.data[key]
				}
				return fields
			},
			{}
		),
	}).then(() => {
		paymentGateway.reload()
		close()
	})
}

const allGatewayOptions = computed(() => {
	let options: string[] = []
	let gatewayList = allGateways.data?.map((gateway: any) => gateway.name) || []
	gatewayList.forEach((gateway: any) => {
		console.log(gateway)
		let gatewayName = gateway.split(' ')[0]
		let existingGateways =
			paymentGateways.value?.data?.map((pg: any) => pg.name) || []
		if (
			!options.includes(gatewayName) &&
			!existingGateways.includes(gatewayName)
		) {
			options.push(gatewayName)
		}
	})
	return options.map((gateway: string) => ({ label: gateway, value: gateway }))
})
</script>
