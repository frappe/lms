<template>
	<TeacherPage :breadcrumbs="breadcrumbs" :state="page">
		<template #actions>
			<router-link :to="{ name: 'CopilotImports' }">
				<HeaderButton
					:label="__('New course from documents')"
					icon="lucide-file-up"
					variant="subtle"
				/>
			</router-link>
		</template>

		<div class="space-y-5">
			<div>
				<h1 class="text-lg-semibold text-ink-gray-9">
					{{ __('Review queue') }}
				</h1>
				<p class="mt-1 text-p-base text-ink-gray-5">
					{{
						__(
							'Everything the assistant drafts waits here until you approve it.'
						)
					}}
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button
					v-for="filter in filters"
					:key="filter.key"
					:variant="filter.active ? 'solid' : 'subtle'"
					:aria-pressed="filter.active ? 'true' : 'false'"
					data-testid="copilot-kind-filter"
					@click="setKind(filter.key)"
				>
					{{ filter.label }}
					<span class="ms-1 opacity-70">{{ filter.count }}</span>
				</Button>
				<span class="flex-1" />
				<Button
					v-if="quickRows.length"
					variant="outline"
					data-testid="copilot-quick-approve"
					@click="showQuick = true"
				>
					<template #prefix>
						<span class="lucide-check-check size-4" aria-hidden="true" />
					</template>
					{{
						__('Quick-approve high-confidence feedback ({0})').format(
							quickRows.length
						)
					}}
				</Button>
			</div>

			<p
				v-if="!rows.length"
				class="rounded-lg border border-outline-gray-2 px-5 py-10 text-center text-p-base text-ink-gray-5"
				data-testid="copilot-queue-empty"
			>
				{{
					__(
						'Nothing is waiting for you. Everything the assistant drafts will appear here.'
					)
				}}
			</p>
			<div
				v-else
				class="overflow-x-auto rounded-lg border border-outline-gray-2"
			>
				<table class="w-full text-p-base">
					<thead>
						<tr
							class="border-b border-outline-gray-2 text-start text-p-sm text-ink-gray-5"
						>
							<th class="px-3 py-2 text-start font-normal">{{ __('Type') }}</th>
							<th class="px-3 py-2 text-start font-normal">
								{{ __('Content') }}
							</th>
							<th class="px-3 py-2 text-start font-normal">
								{{ __('Learner') }}
							</th>
							<th class="px-3 py-2 text-start font-normal">
								{{ __('AI confidence') }}
							</th>
							<th class="px-3 py-2 text-start font-normal">
								{{ __('Waiting') }}
							</th>
							<th class="px-3 py-2">
								<span class="sr-only">{{ __('Open') }}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in rows"
							:key="row.kind + row.name"
							class="border-b border-outline-gray-1 align-top last:border-b-0"
							data-testid="copilot-queue-row"
						>
							<td class="px-3 py-3">
								<Badge
									variant="subtle"
									:theme="row.kind === 'Escalation' ? 'amber' : 'violet'"
									:label="kindLabel(row.kind)"
								/>
							</td>
							<td class="min-w-[16rem] px-3 py-3">
								<div class="text-ink-gray-9">{{ row.title || row.name }}</div>
								<div v-if="row.course_title" class="text-p-sm text-ink-gray-5">
									{{ row.course_title }}
								</div>
								<div v-if="rowDetail(row)" class="text-p-sm text-ink-gray-5">
									{{ rowDetail(row) }}
								</div>
							</td>
							<td class="px-3 py-3 text-ink-gray-7">{{ row.who || '—' }}</td>
							<td class="px-3 py-3">
								<span v-if="row.kind === 'Escalation'" class="text-ink-gray-5">
									—
								</span>
								<Badge
									v-else
									variant="subtle"
									:theme="confidenceTheme(row.confidence)"
									:label="confidenceLabel(row.confidence)"
								/>
							</td>
							<td class="whitespace-nowrap px-3 py-3 text-ink-gray-5">
								{{ ago(row.created, clockOffset) }}
							</td>
							<td class="px-3 py-3 text-end">
								<router-link :to="rowRoute(row)">
									<Button
										:variant="row.confidence === 'High' ? 'subtle' : 'solid'"
										:label="__('Open')"
									/>
								</router-link>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div
				v-if="courses.length"
				class="flex flex-wrap items-center gap-x-3 gap-y-1 text-p-sm"
			>
				<span class="text-ink-gray-5">{{ __('Weekly report') }}:</span>
				<router-link
					v-for="course in courses"
					:key="course.name"
					:to="{ name: 'CopilotInsight', params: { course: course.name } }"
					class="text-ink-gray-7 underline"
				>
					{{ course.title }}
				</router-link>
			</div>
		</div>

		<TeacherNoteDialog
			v-model:open="showQuick"
			:title="__('Approve {0} feedback drafts?').format(quickRows.length)"
			:body="
				__(
					'Every criterion in these drafts has high confidence. They will be sent to learners unchanged.'
				)
			"
			:confirm-label="__('Approve and send')"
			@confirm="quickApprove"
		>
			<ul class="list-disc space-y-1 ps-5 text-p-base text-ink-gray-8">
				<li v-for="row in quickRows" :key="row.name">
					{{ (row.who || '') + ' — ' + (row.title || row.name) }}
				</li>
			</ul>
		</TeacherNoteDialog>
	</TeacherPage>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, toast, usePageMeta } from 'frappe-ui'
import HeaderButton from '@/components/HeaderButton.vue'
import TeacherPage from '@/components/Copilot/teacher/TeacherPage.vue'
import TeacherNoteDialog from '@/components/Copilot/teacher/TeacherNoteDialog.vue'
import { useTeacherData } from '@/components/Copilot/teacher/useTeacherData'
import { runAction } from '@/components/Copilot/teacher/actions'
import {
	KIND_KEYS,
	ago,
	confidenceLabel,
	confidenceTheme,
	kindLabel,
} from '@/components/Copilot/teacher/format'
import { copilotCall } from '@/copilot/api'

const route = useRoute()
const router = useRouter()
const showQuick = ref(false)

const page = useTeacherData(
	() =>
		copilotCall(
			'get_review_queue',
			route.query.course ? { course: route.query.course } : {}
		),
	() => route.query.course
)

const breadcrumbs = computed(() => [
	{ label: __('Review queue'), route: { name: 'CopilotQueue' } },
])

const kind = computed(() => route.query.kind || '')
const clockOffset = computed(() => page.session.value?.clockOffset || 0)
const allRows = computed(() => page.data.value?.rows || [])
const rows = computed(() =>
	kind.value
		? allRows.value.filter((row) => row.kind === kind.value)
		: allRows.value
)

const filters = computed(() => {
	const data = page.data.value || {}
	return [
		{ key: '', label: __('All'), count: data.total || 0, active: !kind.value },
		...KIND_KEYS.map((key) => ({
			key,
			label: kindLabel(key),
			count: data.counts?.[key] || 0,
			active: kind.value === key,
		})),
	]
})

const quickRows = computed(() => {
	const names = page.data.value?.quick_approve || []
	return allRows.value.filter((row) => names.includes(row.name))
})

const courses = computed(() => {
	const seen = new Map()
	for (const row of allRows.value) {
		if (row.course && !seen.has(row.course)) {
			seen.set(row.course, {
				name: row.course,
				title: row.course_title || row.course,
			})
		}
	}
	return [...seen.values()]
})

function setKind(key) {
	const query = { ...route.query }
	if (key) query.kind = key
	else delete query.kind
	router.replace({ query })
}

function rowDetail(row) {
	const detail = []
	if (row.kind === 'feedback') {
		if (row.detail?.tests)
			detail.push(__('Tests {0} passed').format(row.detail.tests))
		if (row.detail?.flagged) {
			detail.push(
				__('{0} criteria need a closer look').format(row.detail.flagged)
			)
		}
	} else if (row.detail?.summary) {
		detail.push(row.detail.summary)
	}
	return detail.join(' · ')
}

function rowRoute(row) {
	return row.kind === 'feedback'
		? { name: 'CopilotFeedbackReview', params: { draft: row.name } }
		: { name: 'CopilotProposal', params: { proposal: row.name } }
}

async function quickApprove() {
	const drafts = page.data.value?.quick_approve || []
	const result = await runAction(() =>
		copilotCall('bulk_approve_feedback', { drafts })
	)
	if (!result) return
	toast.success(
		__('{0} sent, {1} skipped').format(
			result.approved?.length || 0,
			result.skipped?.length || 0
		)
	)
	page.reload({ quiet: true })
}

usePageMeta(() => ({ title: __('Review queue') }))
</script>
