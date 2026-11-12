<template>
	<section v-if="skills.data?.length" class="space-y-4">
		<div class="space-y-1">
			<h2 class="text-3xl-semibold text-ink-gray-9">
				{{ __('Practise what you learned') }}
			</h2>
			<p class="text-p-base text-ink-gray-6">
				{{
					__(
						'You finished the course. Now try it on real situations with Lumi, so it sticks.'
					)
				}}
			</p>
		</div>
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
			<SkillCard
				v-for="skill in skills.data"
				:key="skill.name"
				v-bind="learnerCard(skill)"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { createResource } from 'frappe-ui'
import SkillCard from '@/components/Goals/SkillCard.vue'
import { learnerCard, type LearnerSkill } from '@/utils/goals'

// Shown once the learner finishes the course; the server decides, so a skill for named
// people or one not published never reaches this list.
const props = defineProps<{ course: string; finished: boolean }>()

const skills = createResource({
	url: 'lms.lms.ai.api.course_practice',
	makeParams: () => ({ course: props.course }),
}) as { data: LearnerSkill[] | null; reload: () => void }

watch(
	() => [props.course, props.finished],
	() => {
		if (props.course && props.finished) skills.reload()
	},
	{ immediate: true }
)
</script>
