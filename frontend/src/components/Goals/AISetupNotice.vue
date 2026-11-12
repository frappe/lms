<template>
	<Alert
		v-if="status.data && !status.data.ready"
		theme="amber"
		class="mb-6"
		:title="__('Connect an AI model to get started')"
		:description="message"
	>
		<template #actions>
			<Button :href="safeUrl(setupLink)">
				{{
					!status.data.chat_model
						? __('Add a model')
						: __('Choose embedding model')
				}}
			</Button>
		</template>
	</Alert>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, createResource } from 'frappe-ui'
import { safeUrl } from '@/utils/safeUrl'

const status = createResource({ url: 'lms.lms.ai.api.ai_status', auto: true })

const setupLink = computed(() =>
	status.data?.chat_model
		? '/app/flow-knowledge-settings'
		: '/app/flow-model/new'
)

const message = computed(() =>
	!status.data?.chat_model
		? __(
				'Add a provider key in Flow Provider and a chat model in Flow Model. It builds your plans, tutors your learners and reviews their role-plays.'
		  )
		: __(
				'Choose an embedding model in Flow Knowledge Settings, so the AI can search the material you add.'
		  )
)
</script>
