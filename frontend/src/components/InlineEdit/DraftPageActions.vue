<template>
	<div class="flex items-center gap-2">
		<Tooltip :text="saveFirst">
			<span>
				<Button variant="outline" disabled>
					<template #prefix>
						<span class="lucide-eye size-4" />
					</template>
					{{ __('Student view') }}
				</Button>
			</span>
		</Tooltip>
		<Tooltip :text="saveFirst">
			<span>
				<Button variant="subtle" disabled>{{ __('Publish') }}</Button>
			</span>
		</Tooltip>
		<slot />
	</div>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'

/** Header actions of a page not saved yet: preview and publish wait for the save. */
defineProps<{ saveFirst: string }>()
</script>
