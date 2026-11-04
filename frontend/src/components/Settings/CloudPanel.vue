<template>
	<div class="relative h-full">
		<div
			v-if="loading"
			data-cloud-loading
			class="space-y-3 px-4 pt-6 sm:px-10 sm:pt-9"
		>
			<Skeleton class="h-7 w-40 rounded-4" />
			<Skeleton v-for="n in 3" :key="n" class="h-24 rounded-6" />
		</div>
		<EmptyStateLayout
			v-else-if="failed"
			:name="__('Cloud Settings')"
			:title="__('Could not load Cloud Settings')"
			:description="__('Please contact support.')"
			icon="lucide-cloud-off"
		>
			<Button
				:label="__('Contact support')"
				icon-left="lucide-life-buoy"
				href="https://support.frappe.io"
			/>
		</EmptyStateLayout>
		<div ref="host" data-cloud-host class="h-full" />
	</div>
</template>

<script setup lang="ts">
import {
	closeCloudSettings,
	openCloudSettings,
	type CloudSettingsPanel,
} from '@frappe/cloud-sdk'
import { Button, Skeleton, toast } from 'frappe-ui'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { cloudContext, translate } from '@/composables/cloudSettings'
import { refreshTrial } from '@/composables/useTrialCard'

const props = defineProps<{ panel: CloudSettingsPanel }>()
const host = ref<HTMLElement>()
const loading = ref(true)
const failed = ref(false)

onMounted(() => {
	openCloudSettings({
		target: host.value,
		panels: [props.panel],
		theme: 'auto',
		translate,
		// Saves the SDK a get_context request
		context: cloudContext(),
	})
		.catch((error: unknown) => {
			failed.value = true
			toast.error(
				error instanceof Error && error.message
					? error.message
					: __('Could not open Cloud Settings')
			)
		})
		.finally(() => (loading.value = false))
})

onBeforeUnmount(() => {
	closeCloudSettings()
	// A plan chosen in billing ends the trial
	if (props.panel === 'billing') refreshTrial()
})
</script>
