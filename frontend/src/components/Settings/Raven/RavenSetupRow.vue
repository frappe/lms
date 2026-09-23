<template>
	<div class="flex flex-col gap-3">
		<div class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 items-center gap-3">
				<span
					class="lucide-messages-square size-8 shrink-0 text-ink-gray-5"
					:class="{ 'opacity-60': !!missing }"
					aria-hidden="true"
				/>
				<div class="flex min-w-0 flex-col gap-0.5">
					<span class="text-p-base-medium text-ink-gray-8">
						{{ __('Enable Raven Integration') }}
					</span>
					<span class="text-p-sm text-ink-gray-6">
						{{ __('Sync members into channels by rule.') }}
					</span>
				</div>
			</div>
			<Button
				variant="solid"
				:disabled="!!missing"
				:loading="loading"
				@click="emit('enable')"
			>
				{{ __('Enable') }}
			</Button>
		</div>

		<p v-if="missing" class="text-p-sm text-ink-gray-7">
			{{ sentence[0]
			}}<a
				v-if="missing === 'raven'"
				v-external
				:href="MARKETPLACE_URL"
				class="font-medium text-ink-gray-8 underline underline-offset-2"
				>{{ appName }}</a
			><span v-else>{{ appName }}</span
			>{{ sentence[1] }}
		</p>
	</div>
</template>

<script setup lang="ts">
// The integration as one row, whatever state it is in. Helpdesk's
// ERPNextIntegrationSettings.vue, where a missing app is a badge beside the
// panel title and a sentence under this row rather than a coloured strip or a
// page of its own. Nothing here moves between the states; only the sentence
// comes and goes, so the control never changes place under the reader.
//
// Enable is one-way (raven_integration.api.enable_integration), so the control
// is a Button where Helpdesk has a Switch: a Switch would draw an off position
// that no endpoint can reach.
import { Button } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps<{
	/** Which app is missing, or null when both are installed. */
	missing: 'raven' | 'raven_integration' | null
	/** True while the enable request is in flight. */
	loading?: boolean
}>()

const emit = defineEmits<{ enable: [] }>()

// raven_integration installs at the bench and has no marketplace page, so only
// Raven's half of the sentence is a link.
const MARKETPLACE_URL = 'https://cloud.frappe.io/marketplace/apps/raven'

// One string with a placeholder, split around the app name at render time. Three
// separate __() calls could not be reordered by a translator, gave the fragments
// no context in the POT file, and fixed an English word order into the DOM, which
// is also what an RTL locale has to undo.
const sentence = computed<string[]>(() =>
	__('Install the {0} app to enable this integration.').split('{0}')
)

// Not translated: both are the app's own name as it is spelled everywhere else.
const appName = computed<string>(() =>
	props.missing === 'raven' ? 'Raven' : 'raven_integration'
)
</script>
