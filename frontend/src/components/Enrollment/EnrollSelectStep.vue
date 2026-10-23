<template>
	<StudentPicker
		v-model="members"
		v-model:checking="checking"
		:enrollDoctype="target.doctype"
		:enrollDocname="target.name"
		:includeEnrolled="includeEnrolled"
	>
		<template #beforeList>
			<div
				v-if="target.paidKind"
				data-testid="switch"
				class="flex items-center justify-between gap-3"
			>
				<div class="min-w-0 space-y-0.5">
					<div
						:id="labelId"
						data-testid="switch-label"
						class="text-p-base font-medium text-ink-gray-8"
					>
						{{ paidSwitchLabel(target.paidKind) }}
					</div>
					<p
						:id="descriptionId"
						data-testid="switch-description"
						class="text-p-sm text-ink-gray-6"
					>
						{{ paidSwitchDescription(target.paidKind, target.priceLabel) }}
					</p>
				</div>
				<Switch
					v-model="paid"
					size="md"
					class="shrink-0"
					:aria-labelledby="labelId"
					:aria-describedby="descriptionId"
				/>
			</div>
		</template>
		<template #list="{ students, remove }">
			<slot name="list" :students="students" :remove="remove" />
		</template>
	</StudentPicker>
</template>
<script setup lang="ts">
import { Switch } from 'frappe-ui'
import { computed, useId } from 'vue'
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

const labelId = useId()
const descriptionId = useId()

const includeEnrolled = computed<boolean>(
	() => paid.value && props.target.paidKind === 'certificate'
)
</script>
