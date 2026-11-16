<template>
	<Dialog v-model:open="show" :title="__('Learning Consistency')">
		<template #default>
			<div class="text-base">
				<div class="text-center">
					<div class="text-[30px]">🔥</div>
					<div class="mt-3">
						<div class="text-ink-gray-6 mb-1">
							{{
								streakInfo.data?.current_streak < 1
									? __('You can do better, you are on a')
									: streakInfo.data?.current_streak < 10
									? __('Keep going, you are on a')
									: __('You rock, you are on a')
							}}
						</div>
						<div class="text-2xl-semibold text-ink-gray-9">
							{{
								__('{0} day streak').format(
									streakInfo.data?.current_streak ?? 0
								)
							}}
						</div>
					</div>
				</div>

				<div
					class="grid grid-cols-2 bg-surface-gray-1 px-2.5 py-2 rounded-5 mt-8"
				>
					<div class="space-y-1 border-e border-outline-gray-2 me-4">
						<div class="text-ink-gray-6">
							{{ __('Current Streak') }}
						</div>
						<div class="text-lg-semibold text-ink-gray-9">
							{{ __('{0} days').format(streakInfo.data?.current_streak ?? 0) }}
						</div>
					</div>
					<div class="space-y-1">
						<div class="text-ink-gray-6">
							{{ __('Longest Streak') }}
						</div>
						<div class="text-lg-semibold text-ink-gray-9">
							{{ __('{0} days').format(streakInfo.data?.longest_streak ?? 0) }}
						</div>
					</div>
				</div>

				<div
					class="text-ink-gray-7 border border-outline-gray-1 px-2.5 py-2 rounded-5 text-xs leading-5 mt-5"
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
