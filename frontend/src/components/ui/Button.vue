<template>
	<FrappeButton v-bind="attrs" :class="buttonClass">
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
	</FrappeButton>
</template>

<script setup>
import { Button as FrappeButton } from 'frappe-ui'
import { computed, useAttrs, useSlots } from 'vue'
const slots = useSlots()

const attrs = useAttrs()
const hasDefaultSlotIcon = computed(() => {
	const vnodes = slots.default?.()
	if (!vnodes || vnodes.length !== 1) return false

	const vnode = vnodes[0]
	return (
		typeof vnode.type?.name === 'string' &&
		vnode.type.name.startsWith('lucide-')
	)
})

const isIconOnly = computed(() => {
	return !!attrs.icon || !!slots.icon || hasDefaultSlotIcon.value
})
const buttonClass = computed(() => {
	const variantClasses = {
		subtle:
			'!text-primary-700 !bg-primary-50 hover:!bg-primary-100 active:!bg-primary-200',
		solid:
			'!bg-primary-500 hover:!bg-primary-300 active:!bg-primary-400 !text-white',
		outline:
			'!text-primary-600 !border-primary-500 hover:!border-primary-500 hover:!text-white hover:!bg-primary-500',
		ghost: '!text-primary-600 hover:!bg-primary-100 active:!bg-primary-200',
	}[attrs.variant || 'subtle']

	return [
		'!h-10 !font-semibold text-sm !flex !items-center !justify-center !rounded-[8px]',
		(!attrs.theme || attrs.theme === 'gray') && variantClasses,
		isIconOnly.value ? '!w-10 !px-0' : '!px-8',
	]
})
</script>
