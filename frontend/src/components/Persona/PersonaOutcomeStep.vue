<template>
	<div class="flex flex-col gap-0.5">
		<button
			v-for="option in step.options"
			:key="String(option.value)"
			type="button"
			class="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-gray-2 focus:outline-none focus-visible:bg-surface-gray-2"
			@click="emit('choose', option)"
		>
			<span
				class="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-gray-2 text-ink-gray-7 transition-colors group-hover:bg-surface-white"
			>
				<component :is="option.icon" v-if="option.icon" class="size-4" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-p-sm font-medium text-ink-gray-9">
					{{ option.label }}
				</span>
				<span v-if="option.description" class="block text-p-xs text-ink-gray-5">
					{{ option.description }}
				</span>
			</span>
			<LucideChevronRight class="size-4 shrink-0 text-ink-gray-4" />
		</button>
	</div>
</template>

<script setup>
defineProps({
	step: {
		type: Object,
		required: true,
	},
})

const emit = defineEmits(['choose'])
</script>
