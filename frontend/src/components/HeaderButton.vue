<template>
	<Tooltip v-if="isMobile" :text="label">
		<Button
			:variant="variant"
			:theme="theme"
			:loading="loading"
			:disabled="disabled"
			:label="label"
			class="!size-9"
			@click="emit('click')"
		>
			<template #icon>
				<span :class="[icon, 'size-4']" />
			</template>
		</Button>
	</Tooltip>
	<Button
		v-else
		:variant="variant"
		:theme="theme"
		:loading="loading"
		:disabled="disabled"
		@click="emit('click')"
	>
		<template #prefix>
			<span :class="[icon, 'size-4']" />
		</template>
		{{ label }}
	</Button>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'
import { useScreenSize } from '@/utils/composables'

withDefaults(
	defineProps<{
		label: string
		icon: string
		variant?: 'solid' | 'subtle' | 'outline' | 'ghost'
		theme?: 'gray' | 'blue' | 'green' | 'red'
		loading?: boolean
		disabled?: boolean
	}>(),
	{
		variant: 'outline',
		theme: 'gray',
		loading: false,
		disabled: false,
	}
)

const emit = defineEmits<{ (e: 'click'): void }>()

const { isMobile } = useScreenSize()
</script>
