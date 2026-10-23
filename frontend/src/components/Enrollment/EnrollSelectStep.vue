<template>
	<StudentPicker
		v-model="members"
		v-model:checking="checking"
		:enrollDoctype="target.doctype"
		:enrollDocname="target.name"
		:includeEnrolled="includeEnrolled"
	>
		<template #beforeList>
			<SwitchRow
				v-if="target.paidKind"
				v-model="paid"
				size="md"
				:label="paidSwitchLabel(target.paidKind)"
				:description="paidSwitchDescription(target.paidKind, target.priceLabel)"
			/>
		</template>
		<template #list="{ students, remove }">
			<slot name="list" :students="students" :remove="remove" />
		</template>
	</StudentPicker>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import SwitchRow from '@/components/Controls/SwitchRow.vue'
import StudentPicker from '@/components/Enrollment/StudentPicker.vue'
import {
	paidSwitchDescription,
	paidSwitchLabel,
} from '@/components/Enrollment/enrollment'
import type { EnrollTarget } from '@/types'

const props = defineProps<{
	target: EnrollTarget
}>()

const members = defineModel<string[]>('members', { default: () => [] })
const paid = defineModel<boolean>('paid', { default: false })
const checking = defineModel<boolean>('checking', { default: false })

const includeEnrolled = computed<boolean>(
	() => paid.value && props.target.paidKind === 'certificate'
)
</script>
