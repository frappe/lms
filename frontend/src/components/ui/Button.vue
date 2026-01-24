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

const props = defineProps({
	size: {
		type: String,
		default: 'sm',
	},
})

const sizeClasses = computed(() => {
	let sizes =
		{
			sm: '!h-10 !text-sm !px-4 !rounded-[8px]',
			md: '!h-11 !text-base !font-medium !px-5 !rounded-[8px]',
			lg: '!h-12 !text-lg !font-medium !px-6 !rounded-[8px]',
			xl: '!h-14 !text-xl !font-medium !px-8 !rounded-[10px]',
			'2xl': '!h-16 !text-2xl !font-medium !px-10 !rounded-[12px]',
		}[props.size] || '!h-11 !text-base !font-medium !px-5 !rounded-[8px]'

	if (isIconOnly.value) {
		sizes =
			{
				sm: '!h-10 !w-10 !rounded-[8px]',
				md: '!h-11 !w-11 !rounded-[8px]',
				lg: '!h-12 !w-12 !rounded-[8px]',
				xl: '!h-14 !w-14 !rounded-[10px]',
				'2xl': '!h-16 !w-16 !rounded-[12px]',
			}[props.size] || '!h-11 !w-11 !rounded-[8px]'
	}
	return sizes
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
		'!font-semibold !flex !items-center !justify-center [&_svg]:!stroke-2',
		(!attrs.theme || attrs.theme === 'gray') && variantClasses,
		sizeClasses.value,
	]
})
</script>
