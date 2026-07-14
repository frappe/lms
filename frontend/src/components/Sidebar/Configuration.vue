<template>
	<HoverCard side="right" align="start" class="flex w-full">
		<template #trigger>
			<button
				:class="[
					'group w-full flex h-7 items-center justify-between rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-2',
				]"
			>
				<div class="flex gap-2">
					<span class="lucide-wrench size-4" />
					<span class="whitespace-nowrap">
						{{ __('Configuration') }}
					</span>
				</div>
				<span class="lucide-chevron-right h-4 w-4" />
			</button>
		</template>
		<template #default>
			<div class="grid grid-cols-3 justify-between">
				<button
					key="name"
					class="py-1 px-2 hover:bg-surface-gray-2 rounded"
					@click="goToDataImport"
				>
					<div class="flex flex-col items-center space-y-1">
						<span
							class="lucide-arrow-down-to-line size-9 text-ink-gray-7 p-2 bg-surface-gray-2 rounded-md"
						/>
						<div class="text-sm text-ink-gray-7">
							{{ __('Import') }}
						</div>
					</div>
				</button>
			</div>
		</template>
	</HoverCard>
</template>
<script setup lang="ts">
import { HoverCard } from 'frappe-ui'
import { useRouter } from 'vue-router'

const router = useRouter()

function goToDataImport(): void {
	router.push({ name: 'DataImportList', query: { step: 'list' } })
}
</script>
