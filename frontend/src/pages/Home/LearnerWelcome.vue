<template>
	<div class="mx-auto flex max-w-[1080px] flex-col gap-8">
		<header>
			<h1 class="text-2xl-semibold text-ink-gray-9">
				{{ welcome(user.data?.full_name) }}
			</h1>
			<p class="mt-1.5 text-base text-ink-gray-6">
				{{
					hasAny
						? __('Pick something to start with.')
						: __(
								'Nothing to start yet. When someone shares a skill or course with you, it shows up here.'
						  )
				}}
			</p>
		</header>

		<section
			v-if="courses.length"
			aria-labelledby="discover-courses"
			class="flex flex-col gap-3"
		>
			<h2 id="discover-courses" class="text-lg-semibold text-ink-gray-9">
				{{ __('Popular courses') }}
			</h2>
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				<CourseCard
					v-for="course in courses"
					:key="course.name"
					:course="course"
					:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				/>
			</div>
		</section>

		<section
			v-if="skills.length"
			aria-labelledby="discover-skills"
			class="flex flex-col gap-3"
		>
			<h2 id="discover-skills" class="text-lg-semibold text-ink-gray-9">
				{{ __('Popular skills') }}
			</h2>
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				<SkillCard
					v-for="skill in skills"
					:key="skill.name"
					:title="skill.title"
					:description="skill.learner_outcome || skill.outcome"
					:instructor="skill.instructor"
					:meta="
						skill.enrolled_count
							? __('{0} enrolled').format(skill.enrolled_count)
							: ''
					"
					:to="{ name: 'GoalSession', params: { goal: skill.name } }"
				/>
			</div>
		</section>

		<section
			v-if="batches.length"
			aria-labelledby="discover-batches"
			class="flex flex-col gap-3"
		>
			<h2 id="discover-batches" class="text-lg-semibold text-ink-gray-9">
				{{ __('Upcoming public batches') }}
			</h2>
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				<BatchCard
					v-for="batch in batches"
					:key="batch.name"
					:batch="batch"
					:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
				/>
			</div>
		</section>
	</div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { createResource } from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import SkillCard from '@/components/Goals/SkillCard.vue'
import { welcome } from '@/pages/Home/greeting'

type Skill = {
	name: string
	title: string
	minutes?: number
	outcome?: string
	learner_outcome?: string
	instructor?: { full_name: string; image?: string }
	enrolled_count?: number
}

const user = inject<any>('$user')

const discover = createResource({
	url: 'lms.lms.home.discover_home',
	auto: true,
})

const courses = computed<any[]>(() => discover.data?.courses || [])
const skills = computed<Skill[]>(() => discover.data?.skills || [])
const batches = computed<any[]>(() => discover.data?.batches || [])

const hasAny = computed(
	() =>
		!discover.fetched ||
		courses.value.length + skills.value.length + batches.value.length > 0
)
</script>
