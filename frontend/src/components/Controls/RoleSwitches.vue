<template>
	<div class="grid grid-cols-1 gap-5 sm:grid-cols-1 md:grid-cols-2">
		<div v-for="row in ROLE_ROWS" :key="row.key" data-testid="role-row">
			<BooleanSwitch
				size="sm"
				:label="row.label()"
				:description="row.description()"
				:model-value="modelValue[row.key]"
				@update:model-value="
					(value: number | boolean) => emit('toggle', row.key, Boolean(value))
				"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
// The four-role grid, drawn once. Every caller owns its own roles state and
// save timing. Emits `toggle` rather than `update:modelValue`, so a caller
// never has to guess whether the event already wrote through.
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import {
	ROLE_ROWS,
	type MemberRoleKey,
	type MemberRoles,
} from '@/components/Settings/Members/members'

defineProps<{ modelValue: MemberRoles }>()

const emit = defineEmits<{
	toggle: [key: MemberRoleKey, value: boolean]
}>()
</script>
