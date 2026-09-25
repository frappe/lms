<template>
	<TeacherPage :breadcrumbs="breadcrumbs" :state="page" allow-empty>
		<TeacherNotice
			v-if="!insight"
			:title="__('No weekly report yet')"
			:text="__('The assistant has not written a report for this course.')"
		/>
		<div v-else class="space-y-5">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="me-2 text-lg-semibold text-ink-gray-9">
					<router-link
						:to="{
							name: 'CourseDetail',
							params: { courseName: insight.course },
						}"
						class="hover:underline"
						>{{ insight.course_title || insight.course }}</router-link
					>
					<span class="text-ink-gray-5">
						· {{ __('Week of {0}').format(insight.week_start) }}
					</span>
				</h1>
				<TeacherStatusBadge :status="insight.status" />
			</div>

			<div class="flex flex-wrap gap-2" data-testid="copilot-insight-stats">
				<Badge
					v-for="(value, key) in insight.stats || {}"
					:key="key"
					variant="subtle"
					theme="gray"
					size="lg"
					:label="statLabel(key) + ': ' + value"
				/>
			</div>

			<div class="grid gap-4 lg:grid-cols-2">
				<section
					class="min-w-0 space-y-4 rounded-lg border border-outline-gray-2 p-4"
				>
					<h2 class="text-base-semibold text-ink-gray-9">
						{{ __('Where the class is stuck') }}
					</h2>
					<div class="space-y-2">
						<div
							v-for="(group, index) in groups"
							:key="index"
							class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-3 text-p-base"
							data-testid="copilot-insight-bar"
						>
							<span class="truncate text-ink-gray-8" :title="group.title">
								{{ group.title }}
							</span>
							<span class="h-2 overflow-hidden rounded-full bg-surface-gray-2">
								<span
									class="block h-full rounded-full bg-surface-violet-7"
									:style="{ width: barWidth(group) + '%' }"
								/>
							</span>
							<span class="text-end text-ink-gray-7">{{
								groupValue(group)
							}}</span>
						</div>
					</div>

					<template v-if="insight.at_risk?.length">
						<h3 class="text-base-semibold text-ink-gray-9">
							{{ __('Learners needing attention') }}
						</h3>
						<table class="w-full text-p-base">
							<tbody>
								<tr
									v-for="(entry, index) in insight.at_risk"
									:key="index"
									class="border-b border-outline-gray-1 last:border-b-0"
								>
									<td class="py-2 pe-3 text-ink-gray-8">
										{{ entry.learner || '' }}
									</td>
									<td class="py-2 text-ink-gray-6">{{ entry.reason || '' }}</td>
								</tr>
							</tbody>
						</table>
					</template>
				</section>

				<section class="min-w-0 space-y-3">
					<div
						v-for="(group, index) in groups"
						:key="index"
						class="space-y-2 rounded-lg border border-outline-gray-2 p-4"
						data-testid="copilot-insight-group"
					>
						<div class="flex items-center gap-2">
							<span class="text-p-base font-medium text-ink-gray-9">
								{{ group.title }}
							</span>
							<span class="flex-1" />
							<Badge
								v-if="group.learners"
								variant="subtle"
								theme="gray"
								:label="__('{0} learners').format(group.learners)"
							/>
						</div>
						<p class="whitespace-pre-wrap text-p-base text-ink-gray-7">
							{{ group.summary }}
						</p>
						<details v-if="group.evidence?.length" class="text-p-sm">
							<summary class="cursor-pointer text-ink-gray-6">
								{{ __('Evidence ({0})').format(group.evidence.length) }}
							</summary>
							<ul class="mt-1 list-disc space-y-1 ps-5 text-ink-gray-7">
								<li v-for="(entry, i) in group.evidence" :key="i">
									{{ evidenceLabel(entry) }}
								</li>
							</ul>
						</details>
						<div
							v-if="group.suggestion"
							class="rounded bg-surface-gray-2 px-3 py-2 text-p-sm text-ink-gray-8"
						>
							<b>{{ __('Suggestion:') }}</b> {{ group.suggestion }}
						</div>
						<div v-if="group.proposals?.length" class="flex flex-wrap gap-3">
							<div
								v-for="proposal in group.proposals"
								:key="proposal"
								class="flex items-center gap-2"
							>
								<router-link
									:to="{ name: 'CopilotProposal', params: { proposal } }"
								>
									<Button :label="__('Review proposal')" />
								</router-link>
								<TeacherStatusBadge
									:status="group.proposal_status?.[proposal] || ''"
								/>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	</TeacherPage>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Badge, Button, usePageMeta } from 'frappe-ui'
import TeacherPage from '@/components/Copilot/teacher/TeacherPage.vue'
import TeacherNotice from '@/components/Copilot/teacher/TeacherNotice.vue'
import TeacherStatusBadge from '@/components/Copilot/teacher/TeacherStatusBadge.vue'
import { useTeacherData } from '@/components/Copilot/teacher/useTeacherData'
import { evidenceLabel, statLabel } from '@/components/Copilot/teacher/format'
import { copilotCall } from '@/copilot/api'

const props = defineProps({
	course: { type: String, required: true },
})

const route = useRoute()

const page = useTeacherData(
	() =>
		copilotCall('get_weekly_insight', {
			course: props.course,
			...(route.query.week_start ? { week_start: route.query.week_start } : {}),
		}),
	() => [props.course, route.query.week_start]
)

const insight = computed(() => page.data.value)
const groups = computed(() => insight.value?.groups || [])

const groupValue = (group) => group.count || group.learners || 0
const maxValue = computed(() => Math.max(1, ...groups.value.map(groupValue)))
const barWidth = (group) =>
	Math.round((groupValue(group) / maxValue.value) * 100)

const breadcrumbs = computed(() => [
	{ label: __('Review queue'), route: { name: 'CopilotQueue' } },
	{
		label: insight.value?.course_title || props.course,
		route: { name: 'CopilotInsight', params: { course: props.course } },
	},
])

usePageMeta(() => ({
	title: insight.value?.course_title || __('Weekly report'),
}))
</script>
