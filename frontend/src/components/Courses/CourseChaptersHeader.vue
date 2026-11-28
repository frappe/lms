<template>
	<div class="flex items-center justify-between gap-2">
		<div
			class="flex min-w-0 items-center gap-2 text-p-base-medium text-ink-gray-9"
		>
			<Button
				v-if="collapsible"
				variant="ghost"
				size="sm"
				class="-mx-1.5"
				data-testid="hide-chapters"
				:label="__('Hide chapters')"
				:tooltip="__('Hide chapters')"
				@click="emit('hide')"
			>
				<template #icon>
					<span class="lucide-panel-right-close size-4 text-ink-gray-6" />
				</template>
			</Button>
			<span
				v-else
				class="lucide-panel-right size-4 shrink-0 text-ink-gray-6"
				aria-hidden="true"
			/>
			{{ __('Chapters') }}
			<span
				v-if="count"
				data-testid="chapters-count"
				class="text-p-sm tabular-nums text-ink-gray-6"
			>
				{{ count }}
			</span>
		</div>
		<div class="flex items-center">
			<Button
				data-testid="add-chapter"
				class="!rounded-e-none"
				@click="emit('add-chapter')"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Add') }}
			</Button>
			<Dropdown align="end" :options="addOptions">
				<Button
					data-testid="add-options"
					class="!rounded-s-none border-s border-outline-gray-2"
					:label="__('More ways to add')"
				>
					<template #icon>
						<span class="lucide-chevron-down size-4" />
					</template>
				</Button>
			</Dropdown>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, Dropdown } from 'frappe-ui'

defineProps<{ count?: number; collapsible?: boolean }>()

const emit = defineEmits<{
	'add-chapter': []
	'upload-scorm': []
	hide: []
}>()

const addOptions = [
	{
		label: __('Chapter'),
		icon: 'lucide-folder-plus',
		onClick: () => emit('add-chapter'),
	},
	{
		label: __('SCORM packages'),
		icon: 'lucide-package',
		onClick: () => emit('upload-scorm'),
	},
]
</script>
