<template>
	<div
		class="flex size-8 cursor-pointer items-center justify-center rounded-xl bg-surface-gray-2 hover:bg-surface-gray-3"
		:class="{ 'ring-2 ring-outline-gray-4': selected }"
	>
		<img v-if="logo" :src="logo" class="size-4" />
		<LucideMail v-else class="size-4 text-ink-gray-7" />
	</div>
	<p v-if="serviceName" class="mt-2 text-center text-xs text-ink-gray-6">
		{{ serviceName }}
	</p>
</template>

<script setup lang="ts">
import { Mail as LucideMail } from 'lucide-vue-next'

interface P {
	serviceName?: string
	logo?: string
	selected?: boolean
}

withDefaults(defineProps<P>(), {
	serviceName: '',
	selected: false,
	logo: '',
})
</script>
