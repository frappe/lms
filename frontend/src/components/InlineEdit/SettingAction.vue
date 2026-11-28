<template>
	<SettingRow :label="label" :summary="summary" :danger="danger">
		<template #control>
			<Button
				size="sm"
				variant="subtle"
				:theme="danger ? 'red' : 'gray'"
				:loading="loading"
				@click="emit('click')"
			>
				{{ action }}
			</Button>
		</template>
	</SettingRow>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import SettingRow from '@/components/InlineEdit/SettingRow.vue'

/** A settings row with one button, such as Export or Delete. */
defineProps<{
	label: string
	action: string
	summary?: string
	danger?: boolean
	loading?: boolean
}>()
const emit = defineEmits<{ click: [] }>()
</script>
