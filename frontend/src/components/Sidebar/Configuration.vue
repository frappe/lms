<template>
	<Popover placement="right-start" trigger="hover" class="flex w-full">
		<template #target="{ togglePopover }">
			<button
				:class="[
					'group w-full flex h-7 items-center justify-between rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-2',
				]"
			>
				<div class="flex gap-2">
					<Wrench class="size-4 stroke-1.5" />
					<span class="whitespace-nowrap">
						{{ __('Configuration') }}
					</span>
				</div>
				<ChevronRight class="h-4 w-4 stroke-1.5" />
			</button>
		</template>
		<template #body>
			<div
				class="grid grid-cols-3 justify-between mx-3 p-2 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5"
			>
				<div key="name" class="py-1 px-2 hover:bg-surface-gray-2 rounded">
					<router-link
						:to="{
							name: 'DataImportList',
							query: {
								step: 'list',
							},
						}"
					>
						<div class="flex flex-col items-center space-y-1">
							<ArrowDownToLine
								class="size-9 text-ink-gray-7 p-2 bg-surface-gray-2 rounded-md"
							/>
							<div class="text-sm text-ink-gray-7">
								{{ __('Import') }}
							</div>
						</div>
					</router-link>
				</div>
			</div>
		</template>
	</Popover>
</template>
<script setup lang="ts">
import { Popover } from 'frappe-ui'
import { ArrowDownToLine, Wrench, ChevronRight } from 'lucide-vue-next'
</script>
