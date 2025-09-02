<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Learning Consistency'),
		}"
	>
		<template #body-content>
			<div class="text-base">
				<div class="text-center">
					<div class="text-[30px]">🔥</div>
					<div class="mt-3">
						<div class="text-ink-gray-5 mb-1">
							{{
								streakInfo.data?.current_streak < 1
									? __('You can do better,')
									: streakInfo.data?.current_streak < 10
									? __('Keep going,')
									: __('You rock,')
							}}
							{{ __(' you are on a') }}
						</div>
						<div class="font-semibold text-xl">
							{{ streakInfo.data?.current_streak }} {{ __('day streak') }}
						</div>
					</div>
				</div>

				<div
					class="grid grid-cols-2 bg-surface-gray-1 px-2.5 py-2 rounded-md mt-8"
				>
					<div class="space-y-1 border-r border-outline-gray-2 mr-4">
						<div class="text-ink-gray-6">
							{{ __('Current Streak') }}
						</div>
						<div class="font-semibold text-lg">
							{{ streakInfo.data?.current_streak }} {{ __('days') }}
						</div>
					</div>
					<div class="space-y-1">
						<div class="text-ink-gray-6">
							{{ __('Longest Streak') }}
						</div>
						<div class="font-semibold text-lg">
							{{ streakInfo.data?.longest_streak }} {{ __('days') }}
						</div>
					</div>
				</div>

				<div
					class="text-ink-gray-7 border border-outline-gray-1 px-2.5 py-2 rounded-md text-xs leading-5 mt-5"
				>
					{{
						__(
							'Your learning streak counts the number of days in a row you’ve kept up your learning, whether it’s a lesson, quiz, or assignment. Don’t worry, weekends don’t break your streak.'
						)
					}}
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog } from 'frappe-ui'

const show = defineModel<boolean>({
	default: false,
})

const props = defineProps<{
	streakInfo: {
		data: {
			current_streak: number
			longest_streak: number
		}
	}
}>()
</script>
