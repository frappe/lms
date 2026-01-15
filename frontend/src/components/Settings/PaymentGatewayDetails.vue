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
				v-if="gatewayID != 'new' && paymentGateway.data"
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
					:data="newGatewayData"
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

const show = defineModel<boolean>({ required: true, default: false })
const paymentGateways = defineModel<any>('paymentGateways')
const newGateway = ref(null)
const newGatewayFields = ref([])
const newGatewayData = ref<Record<string, any>>({})

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
	fields: ['name', 'issingle'],
})

const gatewayFields = createResource({
	url: 'lms.lms.api.get_new_gateway_fields',
	makeParams(values: any) {
		return {
			doctype: values.doctype,
		}
	},
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
		}
	}
)

const getNewGateway = () => {
	return allGateways.data?.find((gateway: any) =>
		gateway.name.includes(newGateway.value)
	)
}

watch(newGateway, () => {
	let gatewayDoc = getNewGateway()
	gatewayFields.reload({ doctype: gatewayDoc.name }).then(() => {
		let fields = gatewayFields.data || []
		arrangeFields(fields)
		newGatewayFields.value = fields
		prepareGatewayData()
	})
})

const saveSettings = (close: () => void) => {
	if (props.gatewayID === 'new') {
		saveNewGateway(close)
	} else {
		saveExistingGateway(
			paymentGateway.data.doctype,
			paymentGateway.data.docname,
			close
		)
	}
}

const saveNewGateway = (close: () => void) => {
	let gatewayDoc = getNewGateway()
	if (gatewayDoc.issingle) {
		saveExistingGateway(gatewayDoc.name, gatewayDoc.name, close)
	} else {
		call('frappe.client.insert', {
			doc: {
				doctype: gatewayDoc.name,
				...newGatewayData.value,
			},
		}).then((data: any) => {
			paymentGateways.value.reload()
			close()
		})
	}
}

const saveExistingGateway = (
	doctype: string,
	docname: string,
	close: () => void
) => {
	call('frappe.client.set_value', {
		doctype: doctype,
		name: docname,
		fieldname: getGatewayFields(),
	}).then(() => {
		paymentGateways.value?.reload()
		close()
	})
}

const getGatewayFields = () => {
	let data =
		props.gatewayID == 'new' ? newGatewayData.value : paymentGateway.data.data
	return Object.keys(data).reduce((fields: any, key: string) => {
		if (data[key] && typeof data[key] === 'object') {
			fields[key] = data[key].file_url
		} else {
			fields[key] = data[key]
		}
		return fields
	}, {})
}

const createGatewayRecord = (gatewayDoc: any, data: any = {}) => {
	call('frappe.client.insert', {
		doc: {
			doctype: 'Payment Gateway',
			gateway: newGateway.value,
			gateway_controller: gatewayDoc.issingle ? '' : gatewayDoc.name,
			gateway_settings: gatewayDoc.issingle ? '' : data.name,
		},
	}).then(() => {
		paymentGateways.value?.reload()
	})
}

const allGatewayOptions = computed(() => {
	let options: string[] = []
	let gatewayList = allGateways.data?.map((gateway: any) => gateway.name) || []
	gatewayList.forEach((gateway: any) => {
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

const prepareGatewayData = () => {
	newGatewayData.value = {}
	if (newGatewayFields.value.length) {
		newGatewayFields.value.forEach((field: any) => {
			newGatewayData.value[field.fieldname] = field.default || ''
		})
	}
}
</script>
