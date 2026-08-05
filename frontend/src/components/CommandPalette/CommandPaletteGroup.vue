<template>
	<div v-for="result in list" :key="result.title" class="px-2.5 space-y-2">
		<div class="text-ink-gray-5 px-2">
			{{ result.title }}
		</div>
		<ul class="list-none">
			<li v-for="(item, index) in result.items" :key="index">
				<button
					type="button"
					data-palette-item
					class="flex items-center justify-between p-2 rounded hover:bg-surface-gray-2 cursor-pointer w-full text-start"
					:class="{ 'bg-surface-gray-2': item.isActive }"
					@click="emit('navigateTo', item.route)"
				>
					<div class="flex items-center gap-x-3">
						<component
							v-if="item.icon"
							:is="item.icon"
							class="size-4 stroke-1.5 text-ink-gray-6"
						/>
						<div v-html="sanitizeRichHTML(item.title)"></div>
					</div>
					<div v-if="item.modified" class="text-ink-gray-5">
						{{ dayjs.unix(item.modified).fromNow(true) }}
					</div>
				</button>
			</li>
		</ul>
	</div>
</template>
<script lang="ts" setup>
import { inject } from 'vue'
import { sanitizeRichHTML } from '@/utils/sanitizeRichHTML'

const dayjs = inject<any>('$dayjs')
const emit = defineEmits(['navigateTo'])

const props = defineProps<{
	list: Array<{
		title: string
		items: Array<{
			title: string
			route: { name: string; params?: Record<string, string> }
			icon?: any
			isActive?: boolean
			modified?: string
		}>
	}>
}>()
</script>
