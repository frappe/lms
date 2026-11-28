<template>
	<SettingRow :label="label" :summary="summary">
		<template #control>
			<Link
				v-model="model"
				:doctype="doctype"
				:filters="filters"
				:placeholder="placeholder"
				:aria-label="label"
				:onCreate="onCreate"
				variant="outline"
				align="end"
				class="w-60 max-w-full"
			/>
		</template>
	</SettingRow>
</template>

<script setup lang="ts">
import Link from '@/components/Controls/Link.vue'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'

/** A settings row that picks one record. */
defineProps<{
	label: string
	doctype: string
	summary?: string
	filters?: Record<string, unknown>
	placeholder?: string
	onCreate?: (value: string | null, close?: () => void) => void
}>()
const model = defineModel<string | null | undefined>()
</script>
