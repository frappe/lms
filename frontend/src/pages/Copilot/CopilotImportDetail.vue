<template>
	<TeacherPage :breadcrumbs="breadcrumbs" :state="page">
		<section
			v-if="item"
			class="space-y-4 rounded-6 border border-outline-gray-2 p-5"
		>
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="me-2 text-lg-semibold text-ink-gray-9">{{ item.title }}</h1>
				<TeacherStatusBadge :status="item.status" />
			</div>

			<blockquote
				v-if="item.brief"
				class="whitespace-pre-wrap border-s-4 border-outline-gray-3 ps-3 text-p-base text-ink-gray-7"
			>
				{{ item.brief }}
			</blockquote>

			<p
				v-if="item.error"
				class="rounded bg-surface-red-2 px-3 py-2 text-p-base text-ink-red-8"
				role="alert"
			>
				{{ item.error }}
			</p>

			<p
				v-if="item.status === 'Queued'"
				class="flex items-center gap-2 rounded-6 bg-surface-gray-2 px-3 py-2 text-p-base text-ink-gray-8"
				data-testid="copilot-import-queued"
			>
				<LoadingIndicator class="size-4 shrink-0" />
				{{
					__(
						'The assistant is reading your documents and drafting the course. This usually takes one to three minutes; the page refreshes by itself.'
					)
				}}
			</p>
			<div
				v-else-if="item.proposal"
				class="flex flex-wrap items-center gap-3 text-p-base"
			>
				<TeacherStatusBadge :status="item.proposal.status" />
				<router-link
					:to="{
						name: 'CopilotProposal',
						params: { proposal: item.proposal.name },
					}"
					class="text-ink-gray-9 underline"
					data-testid="copilot-import-proposal"
				>
					{{
						item.proposal.status === 'Pending'
							? __('Review the course draft')
							: __('Open the course draft')
					}}
				</router-link>
				<router-link
					v-if="item.course"
					:to="{ name: 'CourseDetail', params: { courseName: item.course } }"
					class="text-ink-gray-9 underline"
				>
					{{ __('Open the new course (unpublished)') }}
				</router-link>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-p-base">
					<thead>
						<tr
							class="border-b border-outline-gray-2 text-p-sm text-ink-gray-5"
						>
							<th class="py-2 pe-3 text-start font-normal">
								{{ __('Source') }}
							</th>
							<th class="py-2 pe-3 text-start font-normal">{{ __('File') }}</th>
							<th class="py-2 pe-3 text-start font-normal">
								{{ __('Extracted') }}
							</th>
							<th class="py-2" />
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(source, index) in item.sources"
							:key="index"
							class="border-b border-outline-gray-1 last:border-b-0"
						>
							<td class="py-2 pe-3 font-mono text-ink-gray-7">
								{{ source.source }}
							</td>
							<td class="py-2 pe-3 text-ink-gray-8">
								{{ source.file_name || source.file_url }}
							</td>
							<td class="py-2 pe-3 text-ink-gray-7">
								{{
									source.error
										? '—'
										: __('{0} {1}(s), {2} characters').format(
												source.pages,
												unitLabel(source.unit),
												source.chars
											)
								}}
							</td>
							<td class="py-2 text-p-sm text-ink-red-6">
								{{ source.error || '' }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div v-if="canRetry" class="flex border-t border-outline-gray-2 pt-4">
				<Button
					:label="__('Draft again')"
					:loading="retrying"
					data-testid="copilot-import-retry"
					@click="retry"
				/>
			</div>
		</section>
	</TeacherPage>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button, LoadingIndicator, usePageMeta } from 'frappe-ui'
import TeacherPage from '@/components/Copilot/teacher/TeacherPage.vue'
import TeacherStatusBadge from '@/components/Copilot/teacher/TeacherStatusBadge.vue'
import { useTeacherData } from '@/components/Copilot/teacher/useTeacherData'
import { runAction } from '@/components/Copilot/teacher/actions'
import { unitLabel } from '@/components/Copilot/teacher/format'
import { copilotCall } from '@/copilot/api'

const POLL_MS = 5000

const props = defineProps({
	importName: { type: String, required: true },
})

const retrying = ref(false)
let timer = null

const page = useTeacherData(
	() => copilotCall('get_course_import', { name: props.importName }),
	() => props.importName
)

const item = computed(() => page.data.value)

const canRetry = computed(() => {
	const data = item.value
	if (!data) return false
	return (
		data.status === 'Failed' ||
		['Rejected', 'Expired', 'Failed'].includes(data.proposal?.status)
	)
})

const breadcrumbs = computed(() => [
	{ label: __('New course from documents'), route: { name: 'CopilotImports' } },
	{
		label: item.value?.title || props.importName,
		route: {
			name: 'CopilotImportDetail',
			params: { importName: props.importName },
		},
	},
])

function stopPolling() {
	if (timer) clearTimeout(timer)
	timer = null
}

// While the Gateway drafts, refresh every few seconds until it reports back.
// Every load assigns a fresh object, so this re-arms after each poll.
watch(
	() => page.data.value,
	(data) => {
		stopPolling()
		if (data?.status === 'Queued') {
			timer = setTimeout(() => {
				timer = null
				page.reload({ quiet: true })
			}, POLL_MS)
		}
	}
)

onBeforeUnmount(stopPolling)

async function retry() {
	retrying.value = true
	const result = await runAction(
		() => copilotCall('retry_course_import', { name: props.importName }),
		__('Queued again.')
	)
	retrying.value = false
	if (result) page.reload({ quiet: true })
}

usePageMeta(() => ({
	title: item.value?.title || __('New course from documents'),
}))
</script>
