<template>
	<Popover placement="right-start" class="flex w-full" trigger="hover">
		<template #target="{ togglePopover }">
			<button
				:class="[
					'group w-full flex h-7 items-center justify-between rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-2',
				]"
			>
				<div class="flex gap-2">
					<Wrench class="size-4 stroke-1.5 text-ink-gray-7" />
					<span class="whitespace-nowrap">
						{{ __('Configuration') }}
					</span>
				</div>
				<ChevronRight class="h-4 w-4 stroke-1.5" />
			</button>
		</template>
		<template #body-main>
			<div class="text-base p-2">
				<router-link
					:to="{
						name: 'DataImportList',
						query: {
							step: 'list',
						},
					}"
				>
					<div
						class="flex items-center space-x-2 hover:bg-surface-gray-2 px-2 py-1 rounded-sm"
					>
						<ArrowDownToLine class="size-4 stroke-1.5 text-ink-gray-7" />
						<div class="text-sm text-ink-gray-7">
							{{ __('Data Import') }}
						</div>
					</div>
				</router-link>
			</div>
		</template>
	</Popover>
</template>
<script setup>
import { Popover } from 'frappe-ui'
import { ArrowDownToLine, ChevronRight, Wrench } from 'lucide-vue-next'
</script>
