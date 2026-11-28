<template>
	<div class="flex flex-1 flex-col py-5 px-5 w-full lg:w-3/4 lg:px-0 mx-auto">
		<div class="flex items-center justify-between mb-5">
			<h1 class="text-lg-semibold text-ink-gray-9">
				{{ __('All Programs') }}
			</h1>
			<TabButtons v-model="currentTab" :options="tabs" class="w-fit" />
		</div>
		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
		<div
			v-if="programs.loading && !programs.data"
			class="grid grid-cols-1 @4xl:grid-cols-3 gap-5"
			data-testid="program-skeletons"
		>
			<StudentProgramCardSkeleton
				v-for="i in 3"
				:key="i"
				:progress="currentTab === 'enrolled'"
			/>
		</div>
		<template v-for="(data, category) in programs.data" :key="category">
			<template v-if="category == currentTab">
				<div
					v-if="data.length > 0"
					class="grid grid-cols-1 @4xl:grid-cols-3 gap-5"
				>
					<button
						type="button"
						v-for="program in data"
						:key="program.name"
						@click="openDetails(program.name, category)"
						class="block w-full border rounded-5 p-3 hover:border-outline-gray-3 cursor-pointer text-start"
					>
						<div class="text-lg-semibold text-ink-gray-9 mb-2">
							{{ program.name }}
						</div>

						<div class="flex items-center gap-x-5 text-sm text-ink-gray-7">
							<div class="flex items-center gap-x-1">
								<span class="lucide-book-open size-3" />
								<span>
									{{
										program.course_count == 1
											? __('1 course')
											: __('{0} courses').format(program.course_count)
									}}
								</span>
							</div>
							<div class="flex items-center gap-x-1">
								<span class="lucide-user size-4" />
								<span>
									{{
										program.member_count == 1
											? __('1 member')
											: __('{0} members').format(program.member_count || 0)
									}}
								</span>
							</div>
						</div>

						<div v-if="Object.keys(program).includes('progress')" class="mt-5">
							<ProgressBar :progress="program.progress" />
							<div class="text-sm text-ink-gray-7 mt-1">
								{{ __('{0}% completed').format(Math.ceil(program.progress)) }}
							</div>
						</div>
					</button>
				</div>
				<EmptyStateLayout
					v-else
					:name="__('{0} Programs').format(__(convertToTitleCase(category)))"
					icon="lucide-graduation-cap"
				/>
			</template>
		</template>
	</div>
</template>
<script setup lang="ts">
import { createResource, TabButtons } from 'frappe-ui'
import { computed, ref } from 'vue'

import { useRouter } from 'vue-router'
import { convertToTitleCase } from '@/utils'
import ProgressBar from '@/components/ProgressBar.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { openFormRoute } from '@/composables/useFormRoute'
import StudentProgramCardSkeleton from '@/components/Skeletons/StudentProgramCardSkeleton.vue'
import { useLoadingAnnouncement } from '@/utils/a11y'

const currentTab = ref('enrolled')
const router = useRouter()

const programs = createResource({
	url: 'lms.lms.utils.get_programs',
	auto: true,
})

const loadingAnnouncement = useLoadingAnnouncement(
	() => programs.loading,
	() => (programs.data ? __('Programs loaded') : '')
)

const openDetails = (programName: any, category: string) => {
	if (category === 'enrolled') {
		router.push({
			name: 'ProgramDetail',
			params: { programName: programName },
		})
	} else {
		// openFormRoute, not a bare router.push: it stamps the history entry so
		// cancelling pops back to this list rather than ejecting out of the app.
		openFormRoute(router, {
			name: 'ProgramEnrollment',
			params: { programName: programName },
		})
	}
}

const tabs = computed(() => {
	return [
		{
			label: __('Enrolled'),
			value: 'enrolled',
		},
		{
			label: __('Published'),
			value: 'published',
		},
	]
})
</script>
