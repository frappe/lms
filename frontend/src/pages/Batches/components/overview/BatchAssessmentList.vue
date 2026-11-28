<template>
	<section>
		<div class="mb-4 flex items-baseline justify-between gap-4">
			<h2 class="text-3xl-semibold text-ink-gray-9">
				{{ __('Assessments') }}
			</h2>
			<span class="text-p-sm text-ink-gray-6">
				{{ __('Learners take these from their batch dashboard') }}
			</span>
		</div>
		<OverviewListSkeleton
			v-if="isPending"
			data-testid="batch-assessments-skeleton"
			:rows="expected ?? 0"
			footer
		/>
		<OverviewEmptyTile
			v-else-if="(draft || assessments.fetched) && !rows.length"
			icon="lucide-clipboard-check"
			:title="__('No assessments yet')"
			:description="
				__('Learners take the quizzes and assignments you add here.')
			"
		>
			<BatchAssessmentAdd
				:batchName="batchName"
				:added="[]"
				inTile
				@added="assessments.reload()"
				@picked="addPicked"
			/>
		</OverviewEmptyTile>
		<div
			v-else-if="rows.length"
			class="rounded-5 border border-outline-gray-2 p-2"
		>
			<router-link
				v-for="row in rows"
				:key="row.name"
				:to="assessmentRoute(row)"
				class="group/row flex items-center gap-3 rounded-3 px-2 py-1.5 hover:bg-surface-gray-1"
			>
				<span
					class="size-4 shrink-0 text-ink-gray-5"
					:class="types[row.assessment_type]?.icon"
				/>
				<span class="min-w-0 flex-1 truncate text-p-base text-ink-gray-8">
					{{ row.title || row.assessment_name }}
				</span>
				<Button
					variant="ghost"
					size="sm"
					:label="__('Remove {0}').format(row.title || row.assessment_name)"
					class="opacity-0 focus:opacity-100 group-hover/row:opacity-100"
					@click.prevent="removeAssessment(row)"
				>
					<template #icon>
						<span class="lucide-x size-4" />
					</template>
				</Button>
			</router-link>
			<BatchAssessmentAdd
				:batchName="batchName"
				:added="
					rows.map((row) =>
						assessmentKey(row.assessment_type, row.assessment_name)
					)
				"
				@added="assessments.reload()"
				@picked="addPicked"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, call, createResource, toast } from 'frappe-ui'
import OverviewEmptyTile from '@/pages/Batches/components/overview/OverviewEmptyTile.vue'
import OverviewListSkeleton from '@/components/Skeletons/OverviewListSkeleton.vue'
import BatchAssessmentAdd from '@/pages/Batches/components/overview/BatchAssessmentAdd.vue'
import {
	assessmentKey,
	assessmentTypes,
	type BatchAssessment,
} from '@/pages/Batches/components/overview/assessmentTypes'

/** The batch's assessments as instructors edit them: open, remove, add. */
const props = defineProps<{
	batchName?: string
	/** How many assessments the batch has, so the skeleton matches the list. */
	expected?: number
}>()

/** A new batch's assessments, kept here until the batch is first saved. */
const draft = defineModel<BatchAssessment[]>('draft')

const assessments = createResource({
	url: 'lms.lms.utils.get_assessments',
	params: { batch: props.batchName },
	auto: Boolean(props.batchName),
})

const types = assessmentTypes()

const isPending = computed<boolean>(
	() =>
		!draft.value &&
		Boolean(props.batchName) &&
		!assessments.data &&
		!assessments.error
)

const rows = computed<BatchAssessment[]>(
	() => draft.value ?? assessments.data ?? []
)

function addPicked(picked: BatchAssessment[]): void {
	if (draft.value) draft.value = [...draft.value, ...picked]
}

const assessmentRoute = (row: BatchAssessment) =>
	types[row.assessment_type]?.editRoute(row.assessment_name) ?? ''

function removeAssessment(row: BatchAssessment): void {
	if (draft.value) {
		draft.value = draft.value.filter((current) => current.name !== row.name)
		return
	}
	call('lms.lms.api.delete_documents', {
		doctype: 'LMS Assessment',
		documents: [row.name],
	})
		.then(() => assessments.reload())
		.catch((error: { messages?: string[] }) => {
			toast.error(error.messages?.[0] || __('Could not remove the assessment'))
		})
}
</script>
