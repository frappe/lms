<template>
	<div class="grid grid-cols-3 justify-between bg-surface-white">
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
<script setup lang="ts">
import { ArrowDownToLine } from 'lucide-vue-next'
</script>
