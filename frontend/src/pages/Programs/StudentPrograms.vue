<template>
	<div class="py-10 w-3/4 mx-auto">
		<div class="flex items-center justify-between mb-5">
			<div class="text-lg text-ink-gray-9 font-semibold">
				{{ __('All Programs') }}
			</div>
			<TabButtons v-model="currentTab" :buttons="tabs" class="w-fit" />
		</div>
		<div v-for="(data, category) in programs.data">
			<div v-if="category == currentTab" class="grid grid-cols-3 gap-5">
				<div
					v-for="program in data"
					class="border rounded-md p-3 hover:border-outline-gray-3 cursor-pointer"
				>
					<div class="text-lg font-semibold mb-2">
						{{ program.name }}
					</div>

					<!-- <div class="flex items-center space-x-10">
                        <div class="flex items-center space-x-1">
                            <BookOpen class="h-4 w-4 stroke-1.5" />
                            <span>
                                {{ program.course_count }}
                            </span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <User class="h-4 w-4 stroke-1.5" />
                            <span>
                                {{ program.member_count || 0 }}
                            </span>
                        </div>
                    </div> -->

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
		</div>
	</div>
</template>
<script setup lang="ts">
import { createResource, TabButtons } from 'frappe-ui'
import { computed, ref } from 'vue'
import { BookOpen, User } from 'lucide-vue-next'
import ProgressBar from '@/components/ProgressBar.vue'

const currentTab = ref('enrolled')

const programs = createResource({
	url: 'lms.lms.utils.get_programs',
	auto: true,
})

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
