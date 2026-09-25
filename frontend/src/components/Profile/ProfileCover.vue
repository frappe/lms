<template>
	<div class="group relative h-[130px] w-full">
		<img
			v-if="coverImage"
			:src="safeUrl(coverImage)"
			alt=""
			class="h-[130px] w-full object-cover object-center"
		/>
		<div v-else class="bg-surface-gray-2 h-[130px] w-full"></div>
		<div
			class="absolute bottom-[30%] md:bottom-0 start-[50%] mb-4 flex -translate-x-1/2 gap-x-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
			v-if="isSessionUser"
		>
			<EditCoverImage @select="(imageUrl: string) => emit('select', imageUrl)">
				<Button v-if="!readOnly" variant="outline">
					<template #prefix>
						<span class="lucide-edit size-4 text-ink-gray-7" />
					</template>
					{{ __('Edit') }}
				</Button>
			</EditCoverImage>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'
import EditCoverImage from '@/components/Modals/EditCoverImage.vue'
import { safeUrl } from '@/utils/safeUrl'

defineProps<{
	coverImage?: string | null
	isSessionUser: boolean
	readOnly?: boolean
}>()

const emit = defineEmits<{
	select: [url: string]
}>()
</script>
