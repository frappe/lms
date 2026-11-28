<template>
	<Dialog
		v-model:open="open"
		:title="__('Payments app required')"
		:actions="[
			{
				label: __('Get the Payments app'),
				variant: 'solid',
				onClick: ({ close }: { close: () => void }) => {
					openPaymentsApp()
					close()
				},
			},
		]"
	>
		<template #default>
			<p class="text-p-base text-ink-gray-7">
				{{
					__(
						'Selling a paid course, batch or certificate needs the Payments app. Install it from the Frappe Marketplace, then turn on pricing here.'
					)
				}}
			</p>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { hasCloudSettings } from '@/composables/cloudSettings'
import { openSettings } from '@/utils'
import { openExternal } from '@/utils/openExternal'

/** Shown when pricing is turned on but the Payments app is not installed. */
const open = defineModel<boolean>({ default: false })

function openPaymentsApp(): void {
	if (hasCloudSettings()) openSettings('cloud-marketplace')
	else openExternal('https://frappecloud.com/marketplace/apps/payments')
}
</script>
