<template>
	<!-- Borderless centered stack, matching CRM's ERPNextSettings connect state
		 (frappe/crm ERPNextSettings.vue) and the "not enabled" branch in
		 RavenSettings. The parent supplies the 35%-down, centered, gap-3 column. -->
	<span class="lucide-messages-square size-7.5 text-ink-gray-5" />
	<div class="flex flex-col items-center gap-1">
		<span class="text-center text-p-lg-medium text-ink-gray-8">
			{{ title }}
		</span>
		<span class="text-center text-p-base text-ink-gray-6">
			{{ body }}
		</span>
	</div>
	<a v-if="missing === 'raven'" :href="marketplaceUrl" v-external>
		<Button variant="solid">
			{{ __('Get Raven') }}
			<template #suffix>
				<ExternalLink class="size-4 stroke-1.5" />
			</template>
		</Button>
	</a>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { ExternalLink } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{ missing: 'raven' | 'raven_integration' }>()

const marketplaceUrl = 'https://cloud.frappe.io/marketplace/apps/raven'

const title = computed<string>(() =>
	props.missing === 'raven'
		? __('Raven is not installed')
		: __('Raven Integration is not installed')
)

const body = computed<string>(() =>
	props.missing === 'raven'
		? __('Install the Raven app to sync workspace and channel membership.')
		: __(
				'Install the raven_integration app to manage Raven membership from Learning.'
		  )
)
</script>
