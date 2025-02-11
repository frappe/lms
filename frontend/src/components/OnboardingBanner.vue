<template>
	<div v-if="showOnboardingBanner && onboardingDetails.data">
		<Tooltip :text="__('Skip Onboarding')" placement="left">
			<X
				class="w-4 h-4 stroke-1 absolute top-2 right-2 cursor-pointer mr-1"
				@click="skipOnboarding.reload()"
			/>
		</Tooltip>
		<div class="flex items-center justify-evenly bg-surface-gray-2 p-10">
			<div
				@click="redirectToCourseForm()"
				class="flex items-center space-x-2"
				:class="{
					'cursor-pointer': !onboardingDetails.data.course_created?.length,
				}"
			>
				<span
					v-if="onboardingDetails.data.course_created?.length"
					class="py-1 px-1 bg-surface-white rounded-full"
				>
					<Check class="h-4 w-4 stroke-2 text-ink-green-3" />
				</span>
				<span
					v-else
					class="font-semibold bg-surface-white px-2 py-1 rounded-full"
				>
					1
				</span>
				<span class="text-lg font-semibold">
					{{ __('Create a course') }}
				</span>
			</div>
			<div
				@click="redirectToChapterForm()"
				class="flex items-center space-x-2"
				:class="{
					'cursor-pointer':
						onboardingDetails.data.course_created?.length &&
						!onboardingDetails.data.chapter_created?.length,
					'text-ink-gray-3': !onboardingDetails.data.course_created?.length,
				}"
			>
				<span
					v-if="onboardingDetails.data.chapter_created?.length"
					class="py-1 px-1 bg-surface-white rounded-full"
				>
					<Check class="h-4 w-4 stroke-2 text-ink-green-3" />
				</span>
				<span
					v-else
					class="font-semibold bg-surface-white px-2 py-1 rounded-full"
				>
					2
				</span>
				<span class="text-lg font-semibold">
					{{ __('Add a chapter') }}
				</span>
			</div>
			<div
				@click="redirectToLessonForm()"
				class="flex items-center space-x-2"
				:class="{
					'cursor-pointer':
						onboardingDetails.data.course_created?.length &&
						onboardingDetails.data.chapter_created?.length,
					'text-ink-gray-3':
						!onboardingDetails.data.course_created?.length ||
						!onboardingDetails.data.chapter_created?.length,
				}"
			>
				<span
					v-if="onboardingDetails.data.lesson_created?.length"
					class="py-1 px-1 bg-surface-white rounded-full"
				>
					<Check class="h-4 w-4 stroke-2 text-ink-green-3" />
				</span>
				<span class="font-semibold bg-surface-white px-2 py-1 rounded-full">
					3
				</span>
				<span class="text-lg font-semibold">
					{{ __('Add a lesson') }}
				</span>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useSettings } from '@/stores/settings'
import { createResource, Tooltip } from 'frappe-ui'

const showOnboardingBanner = ref(false)
const settings = useSettings()
const onboardingDetails = settings.onboardingDetails
const router = useRouter()

watch(onboardingDetails, () => {
	if (!onboardingDetails.data?.is_onboarded) {
		showOnboardingBanner.value = true
	} else {
		showOnboardingBanner.value = false
	}
})

const redirectToCourseForm = () => {
	if (onboardingDetails.data?.course_created.length) {
		return
	} else {
		router.push({ name: 'CourseForm', params: { courseName: 'new' } })
	}
}

const redirectToChapterForm = () => {
	if (!onboardingDetails.data?.course_created.length) {
		return
	} else {
		router.push({
			name: 'CourseForm',
			params: {
				courseName: onboardingDetails.data?.first_course,
			},
		})
	}
}

const redirectToLessonForm = () => {
	if (!onboardingDetails.data?.course_created.length) {
		return
	} else if (!onboardingDetails.data?.chapter_created.length) {
		return
	} else {
		router.push({
			name: 'LessonForm',
			params: {
				courseName: onboardingDetails.data?.first_course,
				chapterNumber: 1,
				lessonNumber: 1,
			},
		})
	}
}

const skipOnboarding = createResource({
	url: 'frappe.client.set_value',
	makeParams() {
		return {
			doctype: 'LMS Settings',
			name: 'LMS Settings',
			fieldname: 'is_onboarding_complete',
			value: 1,
		}
	},
	onSuccess(data) {
		onboardingDetails.reload()
	},
})
</script>
