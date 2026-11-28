<template>
	<div :class="inTile ? 'flex justify-center' : 'px-1 pt-1'">
		<Button :variant="inTile ? 'subtle' : 'ghost'" @click="openPicker">
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
			{{ __('Add assessment') }}
		</Button>
	</div>
	<PickerDialog
		v-model:open="open"
		:title="__('Add assessments')"
		:items="items"
		:categories="typeLabels"
		:filterLabel="{ name: __('Type'), all: __('All types') }"
		@add="addAssessments"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, call, createResource, toast } from 'frappe-ui'
import PickerDialog from '@/components/InlineEdit/PickerDialog.vue'
import type { PickerItem } from '@/components/InlineEdit/PickerDialog.vue'
import {
	assessmentKey,
	assessmentTypes,
	type AssessmentDoctype,
	type AssessmentRow,
	type BatchAssessment,
} from '@/pages/Batches/components/overview/assessmentTypes'

/** One add button for the assessments; the picker lists every type together. */
const props = defineProps<{
	/** Unset for a batch not saved yet: picks are handed back, not inserted. */
	batchName?: string
	/** `assessmentKey`s already in the batch. */
	added: string[]
	/** Centred subtle button for the empty state's call to action. */
	inTile?: boolean
}>()
const emit = defineEmits<{ added: []; picked: [rows: BatchAssessment[]] }>()

const types = assessmentTypes()
const doctypes = Object.keys(types) as AssessmentDoctype[]
const typeLabels = doctypes.map((doctype) => types[doctype].label)
const open = ref<boolean>(false)

const choices = Object.fromEntries(
	doctypes.map((doctype) => [
		doctype,
		createResource({
			url: 'frappe.client.get_list',
			params: {
				doctype,
				fields: ['name', 'title', ...types[doctype].fields],
				order_by: 'modified desc',
				limit_page_length: 500,
			},
		}),
	])
) as Record<
	AssessmentDoctype,
	{ data: AssessmentRow[] | null; reload: () => void }
>

const toItem = (
	doctype: AssessmentDoctype,
	row: AssessmentRow
): PickerItem => ({
	value: assessmentKey(doctype, row.name),
	title: row.title || row.name,
	icon: types[doctype].icon,
	tint: 'bg-surface-gray-2 text-ink-gray-6',
	category: types[doctype].label,
	meta: [types[doctype].label, ...types[doctype].meta(row)],
})

const items = computed<PickerItem[]>(() =>
	doctypes.flatMap((doctype) =>
		(choices[doctype].data || [])
			.map((row) => toItem(doctype, row))
			.filter((item) => !props.added.includes(item.value))
	)
)

function openPicker(): void {
	open.value = true
	doctypes.forEach((doctype) => choices[doctype].reload())
}

function insertAssessment(key: string) {
	const [doctype, name] = key.split('::')
	return call('frappe.client.insert', {
		doc: {
			doctype: 'LMS Assessment',
			parent: props.batchName,
			parenttype: 'LMS Batch',
			parentfield: 'assessment',
			assessment_type: doctype,
			assessment_name: name,
		},
	})
}

function pickedRow(key: string): BatchAssessment {
	const [doctype, name] = key.split('::') as [AssessmentDoctype, string]
	const row = choices[doctype].data?.find((choice) => choice.name === name)
	return {
		name: key,
		assessment_type: doctype,
		assessment_name: name,
		title: row?.title,
	}
}

async function addAssessments(keys: string[]): Promise<void> {
	if (!props.batchName) {
		emit('picked', keys.map(pickedRow))
		return
	}
	// One at a time: each insert appends a row to the same batch.
	try {
		for (const key of keys) await insertAssessment(key)
	} catch (error) {
		const messages = (error as { messages?: string[] }).messages
		toast.error(messages?.[0] || __('Could not add the assessment'))
	}
	open.value = false
	emit('added')
}
</script>
