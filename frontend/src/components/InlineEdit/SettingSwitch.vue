<template>
	<BooleanSwitch
		v-model="model"
		variant="row"
		class="py-3.5"
		:label="label"
		:description="summary"
	/>
</template>

<script setup lang="ts">
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'

/** A settings row that turns one option on or off. Keeps 0/1 fields as numbers. */
defineProps<{ label: string; summary?: string }>()
const model = defineModel<number | boolean | null | undefined>()
</script>
