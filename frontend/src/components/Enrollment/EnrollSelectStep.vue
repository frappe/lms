<template>
	<StudentPicker
		v-model="members"
		:enrollDoctype="target.doctype"
		:enrollDocname="target.name"
		:includeEnrolled="includeEnrolled"
	>
		<template #beforeList>
			<Switch
				v-if="target.paidKind"
				v-model="paid"
				:label="paidSwitchLabel(target.paidKind)"
				:description="paidSwitchDescription(target.paidKind, target.priceLabel)"
			/>
		</template>
	</StudentPicker>
</template>
<script setup lang="ts">
import { Switch } from 'frappe-ui'
import { computed } from 'vue'
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

const includeEnrolled = computed<boolean>(
	() => paid.value && props.target.paidKind === 'certificate'
)
</script>
