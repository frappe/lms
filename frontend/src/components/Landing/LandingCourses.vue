<template>
	<section
		id="courses"
		class="relative z-[1] mx-auto max-w-6xl scroll-mt-24 px-4 py-14"
	>
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h2 class="lp-section-title">{{ __('Courses') }}</h2>
				<p class="lp-muted mt-2">
					{{
						__('Free and paid courses, taught in batches or self-paced online.')
					}}
				</p>
			</div>
			<div
				class="flex flex-wrap gap-2"
				role="group"
				:aria-label="__('Filter courses')"
			>
				<button
					v-for="tab in tabs"
					:key="tab.value"
					type="button"
					class="lp-tab"
					:aria-pressed="String(active === tab.value)"
					@click="active = tab.value"
				>
					{{ tab.label }}
				</button>
			</div>
		</div>

		<p v-if="courses.loading" class="lp-muted mt-8">
			{{ __('Loading courses…') }}
		</p>
		<p v-else-if="!visible.length" class="lp-muted mt-8">
			{{ __('No courses to show yet.') }}
		</p>

		<div v-else class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			<article
				v-for="course in visible"
				:key="course.name"
				class="lp-card flex flex-col gap-3 p-4"
			>
				<img
					v-if="course.image"
					:src="course.image"
					alt=""
					class="aspect-video w-full max-w-full rounded-lg object-cover"
				/>
				<div class="flex flex-wrap gap-2">
					<span
						class="rounded-md border border-[var(--lp-border-strong)] px-2 py-0.5 text-xs font-medium text-[var(--lp-body)]"
					>
						{{ course.paid_course ? __('Paid') : __('Free') }}
					</span>
					<span
						class="rounded-md bg-[var(--lp-accent)] px-2 py-0.5 text-xs font-medium text-[var(--lp-on-accent)]"
					>
						{{
							course.delivery === 'offline'
								? __('Offline batch')
								: __('Online self-paced')
						}}
					</span>
				</div>
				<h3 class="text-lg font-medium">{{ course.title }}</h3>
				<p v-if="course.short_introduction" class="lp-muted text-sm">
					{{ course.short_introduction }}
				</p>
				<div class="mt-auto pt-2">
					<a
						:href="`/lms/courses/${course.name}`"
						class="lp-btn-secondary no-underline"
						>{{ __('View course') }}</a
					>
				</div>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createResource } from 'frappe-ui'

type Delivery = 'offline' | 'online'
interface LandingCourse {
	name: string
	title: string
	image?: string | null
	short_introduction?: string | null
	paid_course: 0 | 1
	delivery: Delivery
}

const courses = createResource({
	url: 'lms.lms.api.get_landing_courses',
	params: { limit: 12 },
	auto: true,
})

const tabs = [
	{ value: 'all', label: __('All') },
	{ value: 'offline', label: __('Offline batch') },
	{ value: 'online', label: __('Online self-paced') },
] as const

const active = ref<(typeof tabs)[number]['value']>('all')

const visible = computed<LandingCourse[]>(() => {
	const list: LandingCourse[] = (courses.data as LandingCourse[]) || []
	return active.value === 'all'
		? list
		: list.filter((c) => c.delivery === active.value)
})
</script>
