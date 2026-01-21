<template>
	<Button v-bind="$attrs" :class="buttonClass">
		<template v-if="$slots.prefix" #prefix>
			<slot name="prefix" />
		</template>
		<template v-if="$slots.icon" #icon>
			<slot name="icon" />
		</template>
		<slot />
		<template v-if="$slots.suffix" #suffix>
			<slot name="suffix" />
		</template>
	</Button>
</template>

<script setup>
import { Button } from 'frappe-ui'
import { computed, useAttrs } from 'vue'

const attrs = useAttrs()

const buttonClass = computed(() => {
	const variantClasses = {
		subtle:
			'!text-primary-700 !bg-primary-50 hover:!bg-primary-100 active:!bg-primary-200',
		solid:
			'!bg-primary-500 hover:!bg-primary-300 active:!bg-primary-400 !text-white',
		outline:
			'!text-primary-600 !border-primary-500 hover:!border-primary-500 hover:!text-white hover:!bg-primary-500 active:!border-primary-500 active:!bg-primary-500',
		ghost: '!text-primary-600 hover:!bg-primary-100 active:!bg-primary-200',
	}[attrs.variant || 'solid']
	return (
		'!py-3 !px-4 !h-10 font-semibold [&_svg]:stroke-2 text-sm' +
		(!attrs.theme || attrs.theme == 'gray' ? ` ${variantClasses}` : '')
	)
})
</script>
