<template>
	<Button v-bind="$attrs" :class="buttonClass">
		<template v-if="$slots.prefix" #prefix>
			<slot name="prefix" />
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
	return attrs.variant === 'solid' ? '!bg-[#01C295] hover:!bg-[#01C295]/80' : ''
})
</script>