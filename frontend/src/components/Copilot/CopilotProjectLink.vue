<template>
	<div
		v-if="isProject"
		class="flex flex-col gap-3 rounded-6 bg-surface-blue-2 p-3 text-p-sm text-ink-blue-5 sm:flex-row sm:items-center"
		data-testid="copilot-project-link"
	>
		<div class="flex-1 leading-5">
			{{
				__(
					'This is a GitHub project. Submit your repository to get automatic tests and feedback from your teacher.'
				)
			}}
		</div>
		<!-- Inside a lesson this component lives in an iframe, so leave it. -->
		<a
			:href="safeUrl(href)"
			target="_top"
			class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded bg-surface-gray-10 px-3 font-medium text-ink-base hover:bg-surface-gray-9"
		>
			<span class="lucide-git-branch size-4" aria-hidden="true" />
			{{
				project?.submissions?.length
					? __('View project status')
					: __('Submit project')
			}}
		</a>
	</div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { copilotCall } from '@/copilot/api'
import { getLmsRoute } from '@/utils/basePath'
import { safeUrl } from '@/utils/safeUrl'

const props = defineProps({
	assignment: { type: String, required: true },
})

const project = ref(null)

// get_assignment answers for any assignment in a readable course; it is a
// Copilot project when it has a rubric (visible or not) or earlier submissions.
const isProject = computed(() =>
	Boolean(
		project.value?.is_project ||
			project.value?.rubric ||
			project.value?.submissions?.length
	)
)
const href = computed(() =>
	getLmsRoute(`copilot/submit/${encodeURIComponent(props.assignment)}`)
)

watch(
	() => props.assignment,
	async (assignment) => {
		project.value = null
		if (!assignment) return
		try {
			project.value = await copilotCall('get_assignment', { assignment })
		} catch (error) {
			project.value = null
		}
	},
	{ immediate: true }
)
</script>
