<template>
	<ol class="flex flex-wrap gap-2">
		<li
			v-for="idea in ideas"
			:key="idea.idea"
			class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-p-xs"
			:class="
				idea.confirmed
					? 'border-outline-green-2 bg-surface-green-1'
					: 'border-outline-gray-2'
			"
		>
			<span
				class="size-3.5 shrink-0"
				:class="
					idea.confirmed
						? 'lucide-circle-check text-ink-green-6'
						: 'lucide-circle text-ink-gray-6'
				"
				aria-hidden="true"
			/>
			<span :class="idea.confirmed ? 'text-ink-gray-9' : 'text-ink-gray-7'">
				{{ idea.heading }}
				<span class="sr-only">{{
					idea.confirmed ? __('covered') : __('not covered yet')
				}}</span>
			</span>
		</li>
	</ol>
</template>

<script setup lang="ts">
export interface KeyIdea {
	idea: number
	heading: string
	confirmed: boolean
	taught: boolean
}

defineProps<{ ideas: KeyIdea[] }>()
</script>
