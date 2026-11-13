<template>
	<Alert
		v-if="status.data && !status.data.ready"
		theme="amber"
		class="mb-6"
		:title="__('Connect an AI model to get started')"
		:description="message"
	>
		<template #actions>
			<Button :route="{ name: 'Home', hash: '#connect-ai' }">
				{{ __('Connect') }}
			</Button>
		</template>
	</Alert>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, createResource } from 'frappe-ui'

const status = createResource({ url: 'lms.lms.ai.api.ai_status', auto: true })

const message = computed(() =>
	!status.data?.chat_model
		? __(
				'One key from Gemini, OpenAI or another provider, and Lumi can draft plans, tutor learners and review role-plays.'
		  )
		: __(
				'A second key is needed for search, so Lumi can find things in the material you add.'
		  )
)
</script>
