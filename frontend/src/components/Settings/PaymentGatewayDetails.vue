<template>
	<SettingsLayout
		:title="title"
		:description="
			__('Configure the credentials and options for this payment gateway.')
		"
		:show-back="true"
		@back="emit('updateStep', 'list')"
	>
		<template #header-actions>
			<Button variant="solid" @click="save">
				{{ __('Save') }}
			</Button>
		</template>
		<SettingFields
			v-if="gatewayID != 'new' && paymentGateway.data"
			:sections="paymentGateway.data.sections"
			:data="paymentGateway.data.data"
		/>
		<div v-else>
			<div class="flex items-center justify-between gap-4 py-3">
				<div class="flex flex-col">
					<div class="text-p-base font-medium text-ink-gray-7">
						{{ __('Select Payment Gateway') }}
						<span class="text-ink-red-3">*</span>
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Choose a payment provider to configure its credentials.') }}
					</div>
				</div>
				<div class="shrink-0">
					<Select
						v-model="newGateway"
						:options="allGatewayOptions"
						:required="true"
						class="w-48"
					/>
				</div>
			</div>
			<SettingFields
				v-if="newGateway"
				:sections="newGatewayFields"
				:data="newGatewayData"
			/>
		</div>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Button, call, createListResource, createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import SettingFields from '@/components/Settings/SettingFields.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import Select from '@/components/Controls/Select.vue'

const emit = defineEmits<{ updateStep: ['list' | 'form'] }>()

const paymentGateways = defineModel<any>('paymentGateways')
const newGateway = ref(null)
const newGatewayFields = ref<{ columns: { fields: any[] }[] }[]>([])
const newGatewayData = ref<Record<string, any>>({})

const props = defineProps<{
	gatewayID: string | null
}>()

const title = computed(() =>
	props.gatewayID === 'new'
		? __('New Payment Gateway')
		: __('Edit Payment Gateway')
)

const paymentGateway = createResource({
	url: 'lms.lms.api.get_payment_gateway_details',
	makeParams(values: any) {
		return {
			payment_gateway: props.gatewayID,
		}
	},
	transform(data: any) {
		arrangeFields(data.fields)
		data.sections = makeSections(data.fields)
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
}

watch(
	() => props.gatewayID,
	() => {
		if (props.gatewayID && props.gatewayID !== 'new') {
			paymentGateway.reload()
		} else if (props.gatewayID == 'new') {
			allGateways.reload()
		}
	},
	{ immediate: true }
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
		newGatewayFields.value = makeSections(fields)
		prepareGatewayData(fields)
	})
})

const save = () => saveSettings()

const saveSettings = () => {
	if (props.gatewayID === 'new') {
		saveNewGateway()
	} else {
		saveExistingGateway(
			paymentGateway.data.doctype,
			paymentGateway.data.docname
		)
	}
}

const saveNewGateway = () => {
	let gatewayDoc = getNewGateway()
	if (gatewayDoc.issingle) {
		saveExistingGateway(gatewayDoc.name, gatewayDoc.name)
	} else {
		call('frappe.client.insert', {
			doc: {
				doctype: gatewayDoc.name,
				...newGatewayData.value,
			},
		}).then((data: any) => {
			paymentGateways.value.reload()
			emit('updateStep', 'list')
		})
	}
}

const saveExistingGateway = (doctype: string, docname: string) => {
	call('frappe.client.set_value', {
		doctype: doctype,
		name: docname,
		fieldname: getGatewayFields(),
	}).then(() => {
		paymentGateways.value?.reload()
		emit('updateStep', 'list')
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

const prepareGatewayData = (fields: any[]) => {
	newGatewayData.value = {}
	fields.forEach((field: any) => {
		newGatewayData.value[field.name] = field.default || ''
	})
}

const makeSections = (fields: any[]) => {
	const columnCount = fields.length / 3
	let sections: { columns: { fields: any[] }[] }[] = [
		{
			columns: [],
		},
	]

	for (let i = 0; i < columnCount; i++) {
		sections[0].columns.push({
			fields: fields.slice(i * 3, i * 3 + 3),
		})
	}
	return sections
}
</script>
