<template>
	<SidebarCard
		v-if="content"
		:theme="content.theme"
		:title="content.title"
		:description="content.description"
		:dismissible="content.dismissible"
		:action="{
			label: content.action,
			onClick: () => openSettings('cloud-billing'),
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

const { trial, dismiss } = useTrialCard()

const content = computed(() => trial.value && trialCardContent(trial.value))
</script>
