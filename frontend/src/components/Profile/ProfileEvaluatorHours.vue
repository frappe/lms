<template>
	<div class="mt-5" data-testid="hours">
		<h3 class="text-base font-semibold text-ink-gray-9">
			{{ __('Hours') }}
		</h3>
		<p v-if="timezone" class="mt-1 text-p-sm text-ink-gray-6">
			{{ __('Times are in {0}.').format(timezone) }}
		</p>
		<div
			v-if="loadError"
			class="mt-3 rounded-6 border border-outline-gray-2"
			data-testid="week-error"
		>
			<EmptyStateLayout
				:name="__('Hours')"
				icon="lucide-calendar-x-2"
				width="lg"
				:title="__('Could not load hours')"
				:description="__('The request did not get through. Try again.')"
			>
				<Button variant="subtle" :loading="retrying" @click="emit('retry')">
					<span class="text-p-base">{{ __('Retry') }}</span>
				</Button>
			</EmptyStateLayout>
		</div>
		<div
			v-else-if="empty"
			class="mt-3 rounded-6 border border-outline-gray-2"
			data-testid="empty-week"
		>
			<EmptyStateLayout
				:name="__('Hours')"
				icon="lucide-calendar-clock"
				width="lg"
				:title="emptyWeekTitle"
				:description="emptyWeekDescription"
			>
				<div v-if="canEdit" class="flex flex-wrap justify-center gap-2">
					<Button variant="subtle" @click="useStandardWeek">
						<span class="text-p-base">
							{{ __('Use Mon–Fri, 09:00–17:00') }}
						</span>
					</Button>
					<Button variant="outline" @click="emit('startWeek')">
						<span class="text-p-base">{{ __('Set day by day') }}</span>
					</Button>
				</div>
			</EmptyStateLayout>
		</div>
		<div
			v-else
			class="mt-3 rounded-6 border border-outline-gray-2 px-2"
			:data-testid="loading ? 'week-loading' : undefined"
			:aria-busy="loading || undefined"
		>
			<div
				class="hidden gap-x-4 border-b border-outline-gray-2 px-4 py-2 text-p-sm text-ink-gray-6 sm:grid sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto]"
				data-testid="week-header"
				aria-hidden="true"
			>
				<span>{{ __('Day') }}</span>
				<span>{{ __('Total') }}</span>
				<span>{{ __('Hours') }}</span>
			</div>
			<ul>
				<li
					v-for="(day, index) in WEEKDAYS"
					:key="day"
					:data-testid="loading ? undefined : `day-${day}`"
				>
					<div
						v-if="loading"
						class="grid grid-cols-1 items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto]"
					>
						<div class="flex h-7 items-center">
							<Skeleton class="h-4 w-20 rounded-4" />
						</div>
						<div class="hidden h-7 items-center sm:flex">
							<Skeleton class="h-4 w-10 rounded-4" />
						</div>
						<Skeleton class="h-7 w-40 rounded-4" />
						<Skeleton class="h-7 w-24 rounded-4" />
					</div>
					<ProfileEvaluatorDay
						v-else
						v-model:ranges="week[day]"
						:day="day"
						:can-edit="canEdit"
						:errors="errors[day]"
					/>
					<hr
						v-if="index < WEEKDAYS.length - 1"
						class="border-outline-gray-2"
					/>
				</li>
			</ul>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, Skeleton } from 'frappe-ui'
import { computed } from 'vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import ProfileEvaluatorDay from '@/components/Profile/ProfileEvaluatorDay.vue'
import { WEEKDAYS, standardWeek } from '@/utils/evaluatorAvailability'
import type { Week, Weekday } from '@/utils/evaluatorAvailability'

const props = defineProps<{
	canEdit: boolean
	timezone?: string
	loading: boolean
	loadError: boolean
	retrying: boolean
	empty: boolean
	errors: Record<Weekday, Record<number, string>>
}>()

const emit = defineEmits<{ retry: []; startWeek: [] }>()

const week = defineModel<Week>('week', { required: true })

const emptyWeekTitle = computed(() =>
	props.canEdit ? __('No hours yet') : __('No hours set')
)
const emptyWeekDescription = computed(() =>
	props.canEdit
		? __("Students can't book an evaluation with you until you add hours.")
		: __("Students can't book an evaluation with this evaluator yet.")
)

// Staged like any other edit: Discard brings the saved week back.
const useStandardWeek = () => {
	week.value = standardWeek()
}
</script>
