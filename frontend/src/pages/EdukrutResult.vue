<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<a
			v-if="result.data?.pdf_url"
			:href="result.data.pdf_url"
			target="_blank"
			rel="noopener"
		>
			<Button variant="outline">
				📄 {{ __('Download PDF') }}
			</Button>
		</a>
	</header>

	<!-- Loading -->
	<div v-if="result.loading" class="py-20 flex justify-center">
		<LoadingIndicator class="w-6 h-6 text-ink-gray-4" />
	</div>

	<!-- Error -->
	<div
		v-else-if="result.error"
		class="text-center py-20 text-ink-gray-5 text-sm"
	>
		{{ result.error.message || __('Could not load this result.') }}
	</div>

	<div v-else-if="result.data" class="md:w-3/4 md:mx-auto mx-4 py-6 space-y-6">

		<!-- Score card -->
		<div
			v-if="result.data.score != null"
			class="bg-surface-gray-2 rounded-xl px-6 py-5 flex gap-10 flex-wrap"
		>
			<div>
				<div class="text-4xl font-bold text-ink-blue-3 leading-none">
					{{ result.data.score }}/{{ result.data.score_out_of }}
				</div>
				<div class="text-sm text-ink-gray-5 mt-1">{{ __('Score') }}</div>
			</div>
			<div v-if="result.data.percentage != null">
				<div
					class="text-4xl font-bold leading-none"
					:class="result.data.percentage >= 60 ? 'text-green-600' : 'text-red-500'"
				>
					{{ Math.round(result.data.percentage) }}%
				</div>
				<div class="text-sm text-ink-gray-5 mt-1">{{ __('Percentage') }}</div>
			</div>
		</div>

		<!-- Status banner -->
		<div
			v-if="result.data.is_pending"
			class="flex items-start gap-3 border border-yellow-300 bg-yellow-50 rounded-lg px-4 py-3"
		>
			<span class="text-xl mt-0.5">⏳</span>
			<div>
				<div class="font-semibold text-yellow-800">{{ __('Analysis in progress') }}</div>
				<p class="text-sm text-yellow-700 mt-0.5">
					<template v-if="result.data.status === 'queued'">
						{{ __('Your quiz has been queued for AI analysis. Check back in a few minutes.') }}
					</template>
					<template v-else-if="result.data.status === 'report_ready'">
						{{ __('Your report is ready. Explanation videos are still being generated.') }}
					</template>
					<template v-else>
						{{ __('AI analysis is running. This usually takes 2–5 minutes.') }}
					</template>
				</p>
			</div>
		</div>

		<div
			v-else-if="result.data.is_failed"
			class="border border-red-200 bg-red-50 rounded-lg px-4 py-3"
		>
			<div class="font-semibold text-red-700">{{ __('Analysis encountered an error') }}</div>
			<p class="text-sm text-red-600 mt-0.5">
				{{ __('Please contact your teacher to request a re-evaluation.') }}
			</p>
		</div>

		<!-- Concept gaps -->
		<div v-if="result.data.concept_gaps?.length">
			<div class="text-base font-semibold text-ink-gray-9 mb-3">
				{{ __('Concepts to Review') }}
			</div>
			<ul class="space-y-1.5 pl-5 list-disc">
				<li
					v-for="gap in result.data.concept_gaps"
					:key="gap"
					class="text-sm text-ink-gray-7"
				>
					{{ gap }}
				</li>
			</ul>
		</div>

		<!-- Per-question breakdown -->
		<div v-if="result.data.report_items?.length">
			<div class="text-base font-semibold text-ink-gray-9 mb-3">
				{{ __('Question Breakdown') }}
			</div>

			<div
				v-for="(item, idx) in result.data.report_items"
				:key="idx"
				class="border border-outline-gray-2 rounded-lg px-5 py-4 mb-4 space-y-3"
			>
				<!-- Question text -->
				<div class="font-medium text-ink-gray-9">{{ item.Question }}</div>

				<!-- Answer row -->
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span class="text-ink-gray-5">{{ __('Your answer:') }}</span>
						<span class="ml-1 font-medium text-red-500">{{ item.Student_Response }}</span>
					</div>
					<div>
						<span class="text-ink-gray-5">{{ __('Correct answer:') }}</span>
						<span class="ml-1 font-medium text-green-600">{{ item.Right_Ans }}</span>
					</div>
				</div>

				<!-- Collapsible sections -->
				<details v-if="item.Solution" class="group">
					<summary class="cursor-pointer text-sm font-medium text-ink-blue-3 list-none flex items-center gap-1">
						<span class="group-open:hidden">▶</span>
						<span class="hidden group-open:inline">▼</span>
						{{ __('Solution') }}
					</summary>
					<div class="mt-2 pl-4 text-sm text-ink-gray-7 whitespace-pre-wrap">{{ item.Solution }}</div>
				</details>

				<details v-if="item.Confusion" class="group">
					<summary class="cursor-pointer text-sm font-medium text-yellow-700 list-none flex items-center gap-1">
						<span class="group-open:hidden">▶</span>
						<span class="hidden group-open:inline">▼</span>
						{{ __('Why you got it wrong') }}
					</summary>
					<div class="mt-2 pl-4 text-sm text-yellow-700">{{ item.Confusion }}</div>
				</details>

				<details v-if="item.Rec_Learning_strategy" class="group">
					<summary class="cursor-pointer text-sm font-medium text-green-700 list-none flex items-center gap-1">
						<span class="group-open:hidden">▶</span>
						<span class="hidden group-open:inline">▼</span>
						{{ __('How to improve') }}
					</summary>
					<div class="mt-2 pl-4 text-sm text-green-700">{{ item.Rec_Learning_strategy }}</div>
				</details>

				<!-- Video explanation -->
				<div v-if="videoForQuestion(item)" class="mt-2">
					<div class="text-sm font-medium text-ink-gray-7 mb-1.5">
						🎬 {{ __('Video Explanation') }}
					</div>
					<video
						controls
						class="w-full rounded-lg max-h-96 bg-black"
						:src="videoForQuestion(item).url"
					>
						{{ __('Your browser does not support HTML5 video.') }}
					</video>
				</div>
				<div
					v-else-if="videoStatusForQuestion(item) === 'pending' || videoStatusForQuestion(item) === 'processing'"
					class="mt-2 flex items-center gap-2 text-sm text-ink-gray-5"
				>
					<span class="inline-block w-3 h-3 rounded-full bg-ink-gray-3 animate-pulse shrink-0"></span>
					{{ stepLabel(item) }}
				</div>
				<div
					v-else-if="result.data.is_pending"
					class="text-sm text-ink-gray-5 mt-2"
				>
					⏳ {{ __('Video explanation will appear here once analysis is complete.') }}
				</div>
			</div>
		</div>

		<div
			v-else-if="result.data.is_complete"
			class="text-center text-ink-gray-5 py-10"
		>
			{{ __('All answers were correct — no breakdown needed.') }} 🎉
		</div>
	</div>
</template>

<script setup>
import {
	createResource,
	Breadcrumbs,
	Button,
	LoadingIndicator,
	usePageMeta,
} from 'frappe-ui'
import { computed, ref, watch, onUnmounted } from 'vue'

const props = defineProps({
	resultName: {
		type: String,
		required: true,
	},
})

const result = createResource({
	url: 'edukrut_integration.api.get_result_detail',
	params: { result_name: props.resultName },
	auto: true,
})

// Separate ref for video_urls — polled independently so the main result
// data never changes during polling (prevents scroll-to-top on each tick).
const videoUrls = ref({})

watch(
	() => result.data,
	(data) => {
		if (!data) return
		videoUrls.value = data.video_urls || {}
		if (hasVideosInFlight()) startPolling()
	},
	{ immediate: true }
)

const videoPoller = createResource({
	url: 'edukrut_integration.api.get_video_urls',
	params: { result_name: props.resultName },
})

watch(
	() => videoPoller.data,
	(data) => {
		if (!data) return
		videoUrls.value = data
		if (!hasVideosInFlight()) stopPolling()
	}
)

let pollTimer = null

function hasVideosInFlight() {
	return Object.values(videoUrls.value).some(
		(v) => v.status === 'pending' || v.status === 'processing'
	)
}

function startPolling() {
	if (pollTimer) return
	pollTimer = setInterval(() => videoPoller.reload(), 10000)
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
}

onUnmounted(stopPolling)

const STEP_LABELS = {
	'':                __('Queued…'),
	starting:          __('Starting…'),
	pedagogy:          __('Planning approach…'),
	template_selector: __('Selecting template…'),
	scene_plan:        __('Designing scenes…'),
	timeline:          __('Building timeline…'),
	voiceover:         __('Writing voiceover…'),
	tts:               __('Generating audio…'),
	manim_code:        __('Writing animation code…'),
	validator:         __('Validating code…'),
	increment_retry:   __('Retrying code generation…'),
	render:            __('Rendering video…'),
}

function stepLabel(item) {
	const qname = item.frappe_question_name
	if (!qname) return __('Generating video explanation…')
	const step = videoUrls.value[qname]?.current_step || ''
	return STEP_LABELS[step] ?? __('Generating video explanation…')
}

function videoForQuestion(item) {
	const qname = item.frappe_question_name
	if (!qname) return null
	const v = videoUrls.value[qname]
	return v?.url ? v : null
}

function videoStatusForQuestion(item) {
	const qname = item.frappe_question_name
	if (!qname) return null
	return videoUrls.value[qname]?.status || null
}

const breadcrumbs = computed(() => [
	{ label: __('My Results'), route: { name: 'EdukrutResults' } },
	{ label: result.data?.quiz_title || __('Quiz Analysis') },
])

usePageMeta(() => ({
	title: result.data?.quiz_title
		? `${result.data.quiz_title} — ${__('Quiz Analysis')}`
		: __('Quiz Analysis'),
}))
</script>
