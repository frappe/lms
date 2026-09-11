<template>
	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
		<button
			v-for="service in services"
			:key="service.name"
			type="button"
			:data-testid="'provider-' + service.name"
			class="flex items-center gap-2.5 rounded-lg border border-outline-gray-2 p-2.5 text-start transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-1"
			@click="emit('pick', service)"
		>
			<div class="flex size-6 shrink-0 items-center justify-center">
				<img
					v-if="service.icon"
					:src="service.icon"
					:alt="__('{0} icon').format(service.name)"
					class="size-full object-contain"
				/>
				<span v-else class="lucide-mail size-5 text-ink-gray-7" />
			</div>
			<span class="text-p-base text-ink-gray-8">{{ service.name }}</span>
		</button>
	</div>
</template>

<script setup lang="ts">
import type { EmailService } from '@/types'

defineProps<{ services: EmailService[] }>()

const emit = defineEmits<{ pick: [service: EmailService] }>()
</script>
