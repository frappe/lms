<template>
	<SidebarCard
		v-if="content"
		:theme="content.theme"
		:title="content.title"
		:description="content.description"
		:dismissible="content.dismissible"
		:action="{
			label: content.action,
			onClick: choosePlan,
		}"
		@dismiss="dismiss"
	/>
</template>

<script setup lang="ts">
import { SidebarCard } from 'frappe-ui'
import { computed } from 'vue'
import { useTrialCard } from '@/composables/useTrialCard'
import { trialCardContent } from '@/utils/trialCard'
import { openSettings } from '@/utils'
import { useTelemetry } from '@framework/ui/telemetry/index'

const { trial, dismiss } = useTrialCard()
const { capture } = useTelemetry()

// same event as CRM, so upgrade clicks read the same across apps
function choosePlan() {
	capture('upgrade_plan_from_trial_banner')
	openSettings('cloud-billing')
}

const content = computed(() => trial.value && trialCardContent(trial.value))
</script>
