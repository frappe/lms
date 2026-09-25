<template>
	<div class="relative">
		<img
			v-if="image"
			:src="safeUrl(image)"
			:alt="fullName"
			class="object-cover h-[100px] w-[100px] rounded-full border-4 border-[color:var(--surface-base)]"
		/>
		<div
			v-else
			class="flex items-center justify-center h-[100px] w-[100px] rounded-full border-4 border-[color:var(--surface-base)] bg-surface-gray-2 text-4xl-semibold text-ink-gray-7"
		>
			{{ fullName.charAt(0).toUpperCase() }}
		</div>
		<Tooltip
			v-if="openTo"
			:text="openTo === 'Work' ? __('Open to Work') : __('Hiring')"
			side="right"
		>
			<div class="absolute bottom-3 end-1 p-0.5 bg-surface-base rounded-full">
				<div
					class="rounded-full w-fit"
					:class="
						openTo === 'Work'
							? 'bg-surface-green-7 text-white'
							: 'bg-surface-violet-7 text-white'
					"
				>
					<span class="lucide-badge-check size-5" />
				</div>
			</div>
		</Tooltip>
	</div>
</template>
<script setup lang="ts">
import { Tooltip } from 'frappe-ui'
import { safeUrl } from '@/utils/safeUrl'

defineProps<{
	image?: string | null
	fullName: string
	openTo?: string | null
}>()
</script>
