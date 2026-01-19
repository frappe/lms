<template>
	<nav class="flex items-center text-sm">
		<template v-for="(item, index) in items" :key="index">
			<router-link
				:to="item.route"
				class="transition-colors breadcrumb-link"
				:class="[
					index === items.length - 1
						? 'text-ink-gray-9 font-semibold'
						: 'text-ink-gray-5 hover:text-ink-gray-7 !text-sm',
				]"
			>
				{{ item.label }}
			</router-link>
			<ChevronRight
				v-if="index < items.length - 1"
				class="h-4 w-4 mx-1 text-ink-gray-4"
			/>
		</template>
	</nav>
</template>

<script setup>
import { ChevronRight } from 'lucide-vue-next'

defineProps({
	items: {
		type: Array,
		required: true,
		default: () => [],
	},
})
</script>
