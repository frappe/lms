<template>
	<div class="py-5 px-5 w-full lg:w-3/4 lg:px-0 mx-auto">
		<div class="flex items-center justify-between mb-5">
			<div class="text-lg text-ink-gray-9 font-semibold">
				{{ __('All Programs') }}
			</div>
			<TabButtons v-model="currentTab" :buttons="tabs" class="w-fit" />
		</div>
		<div v-for="(data, category) in programs.data">
			<div v-if="category == currentTab">
				<div
					v-if="data.length > 0"
					class="grid grid-cols-1 lg:grid-cols-3 gap-5"
				>
					<div
						v-for="program in data"
						@click="openDetails(program.name, category)"
						class="border rounded-md p-3 hover:border-outline-gray-3 cursor-pointer"
					>
						<div class="text-lg font-semibold mb-2">
							{{ program.name }}
						</div>

						<div class="flex items-center space-x-5 text-sm text-ink-gray-7">
							<div class="flex items-center space-x-1">
								<BookOpen class="size-3 stroke-1.5" />
								<span>
									{{ program.course_count }}
									{{ program.course_count == 1 ? __('course') : __('courses') }}
								</span>
							</div>
							<div class="flex items-center space-x-1">
								<User class="size-4 stroke-1.5" />
								<span>
									{{ program.member_count || 0 }}
									{{ program.member_count == 1 ? __('member') : __('members') }}
								</span>
							</div>
						</div>

						<div v-if="Object.keys(program).includes('progress')" class="mt-5">
							<ProgressBar :progress="program.progress" />
							<div class="text-sm mt-1">
								{{ Math.ceil(program.progress) }}% {{ __('completed') }}
							</div>
						</div>
					</div>
				</div>
				<EmptyState v-else :type="convertToTitleCase(category) + ' Programs'" />
				<!-- <div v-else class="col-span-3 text-center text-ink-gray-5">
                    {{ __('No programs found in this category.') }}
                </div> -->
			</div>
		</div>
	</div>
	<ProgramEnrollment
		v-model="showEnrollmentConfirmation"
		:programName="enrollmentProgram"
	/>
</template>
<script setup lang="ts">
import { createResource, TabButtons } from 'frappe-ui'
import { computed, ref } from 'vue'
import { BookOpen, User } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { convertToTitleCase } from '@/utils'
import ProgressBar from '@/components/ProgressBar.vue'
import ProgramEnrollment from '@/pages/Programs/ProgramEnrollment.vue'
import EmptyState from '@/components/EmptyState.vue'

const currentTab = ref('enrolled')
const router = useRouter()
const showEnrollmentConfirmation = ref(false)
const enrollmentProgram = ref(null)

const programs = createResource({
	url: 'lms.lms.utils.get_programs',
	auto: true,
})

const openDetails = (programName: any, category: string) => {
	if (category === 'enrolled') {
		router.push({
			name: 'ProgramDetail',
			params: { programName: programName },
		})
	} else {
		showEnrollmentConfirmation.value = true
		enrollmentProgram.value = programName
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
