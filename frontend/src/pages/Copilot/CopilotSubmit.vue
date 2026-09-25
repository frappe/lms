<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div class="mx-auto w-full max-w-6xl p-4 sm:p-5">
		<div
			v-if="details.loading && !details.data"
			class="flex items-center gap-2 text-p-sm text-ink-gray-5"
		>
			<LoadingIndicator class="size-4" />
			{{ __('Loading…') }}
		</div>
		<div
			v-else-if="details.error"
			class="rounded-6 bg-surface-red-1 p-4 text-p-sm text-ink-red-6"
			role="alert"
		>
			{{ errorText(details.error) }}
		</div>
		<div
			v-else-if="data"
			class="grid gap-5 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)]"
		>
			<section class="space-y-5 rounded-6 border p-5">
				<h1 class="text-xl font-semibold text-ink-gray-9">
					{{ data.title }}
				</h1>
				<div
					v-if="data.question"
					v-safe-html:rich="data.question"
					class="ProseMirror prose prose-sm max-w-none !whitespace-normal text-ink-gray-8"
				></div>

				<div v-if="data.rubric?.criteria?.length" class="space-y-2">
					<h2 class="text-p-base font-semibold text-ink-gray-9">
						{{ __('How it is graded') }}
					</h2>
					<ul class="list-disc space-y-1 ps-5 text-p-sm text-ink-gray-7">
						<li v-for="(criterion, index) in data.rubric.criteria" :key="index">
							<span class="font-medium text-ink-gray-9">
								{{ criterion.criterion }}
							</span>
							<span v-if="criterion.description">
								— {{ criterion.description }}</span
							>
						</li>
					</ul>
				</div>

				<div class="space-y-2">
					<h2 class="text-p-base font-semibold text-ink-gray-9">
						{{ __('Submit your project') }}
					</h2>
					<form
						class="flex flex-col gap-2 sm:flex-row"
						@submit.prevent="submit"
					>
						<FormControl
							v-model="repoUrl"
							class="flex-1"
							type="url"
							placeholder="https://github.com/you/project"
							:aria-label="__('Repository link')"
							data-testid="repo-url"
						/>
						<Button
							type="submit"
							variant="solid"
							:loading="submitting"
							:disabled="!repoUrl.trim()"
						>
							{{ latest ? __('Submit again') : __('Submit') }}
						</Button>
					</form>
					<p class="text-p-xs text-ink-gray-5">
						{{ __('The repository must be public on GitHub.') }}
					</p>
				</div>
			</section>

			<section class="space-y-5 rounded-6 border p-5" data-testid="status">
				<p v-if="!latest" class="text-p-sm text-ink-gray-5">
					{{ __('You have not submitted this project yet.') }}
				</p>
				<template v-else>
					<div class="flex items-center justify-between gap-2">
						<h2 class="text-p-base font-semibold text-ink-gray-9">
							{{ __('Status') }}
						</h2>
						<Badge :theme="statusTheme(latest.status)">
							{{ __(latest.status) }}
						</Badge>
					</div>
					<a
						:href="safeUrl(latest.repo_url)"
						v-external
						class="block truncate text-p-sm text-ink-gray-7 underline-offset-2 hover:underline"
					>
						{{ latest.repo_url }}
						<span v-if="latest.commit" class="text-ink-gray-5">
							@ {{ latest.commit.slice(0, 7) }}
						</span>
					</a>

					<ol class="space-y-3" data-testid="timeline">
						<li
							v-for="step in latest.timeline"
							:key="step.step"
							class="flex gap-3"
						>
							<span
								class="mt-1 size-3 shrink-0 rounded-full border-2"
								:class="
									step.done
										? 'border-outline-green-7 bg-surface-green-7'
										: step.current
											? 'border-outline-blue-6 bg-surface-base'
											: 'border-outline-gray-3 bg-surface-base'
								"
								aria-hidden="true"
							/>
							<div>
								<div
									class="text-p-sm"
									:class="
										step.done || step.current
											? 'font-medium text-ink-gray-9'
											: 'text-ink-gray-5'
									"
								>
									{{ stepLabel(step.step) }}
									<span v-if="step.done" class="sr-only">
										{{ __('(done)') }}</span
									>
									<span v-else-if="step.current" class="sr-only">
										{{ __('(in progress)') }}</span
									>
								</div>
								<div v-if="step.at" class="text-p-xs text-ink-gray-5">
									{{ formatDate(step.at) }}
								</div>
							</div>
						</li>
					</ol>

					<p
						v-if="latest.status === 'Error'"
						class="rounded-5 bg-surface-red-1 p-3 text-p-sm text-ink-red-6"
						role="alert"
					>
						{{
							__(
								'We could not process this submission. Your teacher has been told.'
							)
						}}
					</p>

					<div v-if="latest.tests" class="space-y-2" data-testid="tests">
						<h3 class="text-p-sm font-semibold text-ink-gray-9">
							{{
								__('Test results ({0}/{1})').format(
									latest.tests.passed,
									latest.tests.total
								)
							}}
						</h3>
						<p v-if="!latest.tests.total" class="text-p-sm text-ink-gray-5">
							{{ __('No test results yet.') }}
						</p>
						<ul v-else class="space-y-1.5">
							<li
								v-for="(test, index) in latest.tests.results"
								:key="index"
								class="flex gap-2 text-p-sm"
							>
								<span
									class="mt-0.5 size-4 shrink-0"
									:class="
										test.passed
											? 'lucide-circle-check text-ink-green-3'
											: 'lucide-circle-x text-ink-red-3'
									"
									aria-hidden="true"
								/>
								<span class="sr-only">
									{{
										test.passed ? __('Test passed') : __('Test did not pass')
									}}
								</span>
								<div class="min-w-0">
									<div class="break-words text-ink-gray-9">{{ test.name }}</div>
									<div
										v-if="test.message"
										class="whitespace-pre-wrap break-words text-p-xs text-ink-gray-5"
									>
										{{ test.message }}
									</div>
								</div>
							</li>
						</ul>
					</div>

					<div v-if="latest.feedback" class="space-y-2" data-testid="feedback">
						<div class="flex items-center gap-2">
							<h3 class="text-p-sm font-semibold text-ink-gray-9">
								{{ __('Feedback from your teacher') }}
							</h3>
							<Badge
								v-if="latest.feedback.result"
								:theme="statusTheme(latest.feedback.result)"
							>
								{{ __(latest.feedback.result) }}
							</Badge>
						</div>
						<div
							class="whitespace-pre-wrap break-words rounded-5 bg-surface-gray-2 p-3 text-p-sm text-ink-gray-8"
						>
							{{ latest.feedback.message }}
						</div>
						<ul
							v-if="latest.feedback.scores?.length"
							class="list-disc space-y-1 ps-5 text-p-sm text-ink-gray-7"
						>
							<li v-for="(score, index) in latest.feedback.scores" :key="index">
								{{ score.criterion }}: {{ score.final_level }}/{{
									score.max_level
								}}
							</li>
						</ul>
					</div>
					<p
						v-else-if="latest.tests"
						class="rounded-5 bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7"
					>
						{{ __('While you wait, look at the tests that did not pass.') }}
					</p>
				</template>
			</section>
		</div>
	</div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
	Badge,
	Button,
	createResource,
	FormControl,
	LoadingIndicator,
	toast,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import { COPILOT_API, copilotCall } from '@/copilot/api'
import { sessionStore } from '@/stores/session'
import { safeUrl } from '@/utils/safeUrl'
import dayjs from '@/utils/dayjs'

const props = defineProps({
	assignment: { type: String, required: true },
})

const route = useRoute()
const { brand } = sessionStore()
const repoUrl = ref('')
const submitting = ref(false)

const STEPS = {
	submitted: () => __('Submitted'),
	tested: () => __('Automatic tests ran'),
	review: () => __('Waiting for your teacher to review the feedback'),
	feedback: () => __('Feedback received'),
}

const details = createResource({
	url: `${COPILOT_API}.get_assignment`,
	makeParams: () => ({ assignment: props.assignment }),
	auto: true,
})

const data = computed(() => details.data)
const latest = computed(() => data.value?.submissions?.[0] || null)

watch(
	latest,
	(value) => {
		if (value?.repo_url && !repoUrl.value) repoUrl.value = value.repo_url
	},
	{ immediate: true }
)

watch(
	() => props.assignment,
	() => {
		repoUrl.value = ''
		details.reload()
	}
)

const breadcrumbs = computed(() => {
	const crumbs = []
	if (data.value?.course) {
		crumbs.push({
			label: data.value.course_title || data.value.course,
			route: {
				name: 'CourseDetail',
				params: { courseName: data.value.course },
			},
		})
	}
	crumbs.push({
		label: data.value?.title || __('Project'),
		route: { name: 'CopilotSubmit', params: { assignment: props.assignment } },
	})
	return crumbs
})

const stepLabel = (step) => (STEPS[step] ? STEPS[step]() : step)

const formatDate = (value) => {
	const date = dayjs(value)
	return date.isValid() ? date.format('DD MMM YYYY, HH:mm') : ''
}

const statusTheme = (status) =>
	({
		Pass: 'green',
		'Feedback Sent': 'green',
		Fail: 'red',
		Error: 'red',
		'Awaiting Review': 'orange',
		'Rewrite Requested': 'orange',
		Submitted: 'blue',
		Testing: 'blue',
	})[status] || 'gray'

const errorText = (error) =>
	error?.messages?.[0] || error?.message || __('Something went wrong.')

const submit = async () => {
	const value = repoUrl.value.trim()
	if (!value || submitting.value) return
	submitting.value = true
	try {
		const args = { assignment: props.assignment, repo_url: value }
		if (route.query?.lesson) args.lesson = String(route.query.lesson)
		await copilotCall('submit_project', args)
		toast.success(__('Submitted. Tests will run shortly.'))
		await details.reload()
	} catch (error) {
		toast.error(errorText(error))
	} finally {
		submitting.value = false
	}
}

usePageMeta(() => ({
	title: data.value?.title || __('Project'),
	icon: brand.favicon,
}))
</script>
