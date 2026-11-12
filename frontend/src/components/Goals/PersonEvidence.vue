<template>
	<Dialog v-model:open="open" :title="title" size="2xl">
		<div
			v-if="data.loading && !data.data"
			class="h-40 animate-pulse rounded-7 bg-surface-gray-2"
		/>
		<div v-else-if="data.data" class="space-y-4">
			<div class="flex flex-wrap items-center gap-2 text-p-sm text-ink-gray-6">
				<Badge :theme="statusTheme(data.data.assignment.status)">{{
					__(data.data.assignment.status)
				}}</Badge>
				<span>{{
					__('Score {0}%').format(data.data.assignment.score || 0)
				}}</span>
				<span v-if="data.data.assignment.acknowledged_on"
					>·
					{{
						__('Acknowledged {0}').format(
							formatDate(data.data.assignment.acknowledged_on)
						)
					}}</span
				>
				<span v-if="data.data.assignment.signed_off_by"
					>·
					{{
						__('Signed off by {0}').format(data.data.assignment.signed_off_by)
					}}</span
				>
				<Button
					v-if="needsSignOff"
					size="sm"
					class="ms-auto"
					:loading="signOff.loading"
					@click="signOff.submit({ assignment })"
				>
					{{ __('Sign off') }}
				</Button>
			</div>
			<p v-if="!data.data.evidence.length" class="text-p-sm text-ink-gray-6">
				{{ __('Nothing recorded yet.') }}
			</p>
			<div
				v-for="row in data.data.evidence"
				:key="row.activity_index"
				class="rounded-7 border border-outline-gray-2 p-4"
			>
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0">
						<div class="text-p-xs text-ink-gray-6">
							{{ activityLabel(row.activity_type) }}
						</div>
						<div class="truncate text-base-medium text-ink-gray-9">
							{{ row.activity_title }}
						</div>
					</div>
					<Badge
						v-if="row.score !== null && row.activity_type !== 'Lesson'"
						:theme="row.passed ? 'green' : 'amber'"
					>
						{{ row.score }}%
					</Badge>
					<Badge v-else theme="gray">{{
						row.status === 'Grading' ? __('Grading') : __('Done')
					}}</Badge>
				</div>
				<p v-if="row.feedback" class="mt-2 text-p-sm text-ink-gray-7">
					{{ row.feedback }}
				</p>
				<template
					v-if="row.activity_type === 'Role-play' && transcript(row).length"
				>
					<button
						type="button"
						class="mt-2 text-p-sm text-ink-gray-6 underline-offset-2 hover:underline"
						@click="
							expanded[row.activity_index] = !expanded[row.activity_index]
						"
					>
						{{
							expanded[row.activity_index]
								? __('Hide conversation')
								: __('Show conversation')
						}}
					</button>
					<div
						v-if="expanded[row.activity_index]"
						class="mt-2 space-y-2 rounded-5 bg-surface-gray-1 p-3 text-p-sm"
					>
						<div v-for="(turn, i) in transcript(row)" :key="i">
							<span class="text-ink-gray-6"
								>{{
									turn.speaker === 'Learner' ? name : __('Character')
								}}:</span
							>
							<span class="text-ink-gray-8"> {{ turn.text }}</span>
						</div>
					</div>
				</template>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Badge, Button, createResource, Dialog } from 'frappe-ui'
import { activityLabel, statusTheme } from '@/utils/goals'
import dayjs from '@/utils/dayjs'

const props = defineProps<{
	assignment: string | null
	name: string
	goalTitle: string
	signOffRequired: boolean
}>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { default: false })

const expanded = reactive<Record<number, boolean>>({})
const title = computed(() => `${props.name} · ${props.goalTitle}`)

const data = createResource({
	url: 'lms.lms.ai.api.person_evidence',
	makeParams: () => ({ assignment: props.assignment }),
})

const signOff = createResource({
	url: 'lms.lms.ai.api.sign_off',
	onSuccess: () => {
		data.reload()
		emit('changed')
	},
})

const needsSignOff = computed(
	() =>
		props.signOffRequired && data.data && !data.data.assignment.signed_off_by
)

const transcript = (row: { response?: string }) => {
	try {
		return JSON.parse(row.response || '{}').transcript || []
	} catch {
		return []
	}
}

const formatDate = (value: string) => dayjs(value).format('D MMM YYYY')

watch(
	() => [open.value, props.assignment],
	() => {
		if (open.value && props.assignment) data.reload()
	},
	{ immediate: true }
)
</script>
