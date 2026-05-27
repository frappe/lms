<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>

	<div class="md:w-3/4 md:mx-auto mx-4 py-6 space-y-4">
		<!-- Loading -->
		<div v-if="results.loading" class="py-16 flex justify-center">
			<LoadingIndicator class="w-6 h-6 text-ink-gray-4" />
		</div>

		<!-- Error -->
		<div
			v-else-if="results.error"
			class="text-center py-16 text-ink-gray-5 text-sm"
		>
			{{ results.error.message || __('Something went wrong.') }}
		</div>

		<!-- Empty -->
		<div
			v-else-if="!results.data?.length"
			class="text-center py-20 space-y-3"
		>
			<div class="text-4xl">📋</div>
			<p class="text-ink-gray-5 text-base">
				{{ __('No results yet. Complete a quiz to see your analysis here.') }}
			</p>
		</div>

		<!-- List -->
		<div
			v-else
			v-for="r in results.data"
			:key="r.name"
			class="flex items-center justify-between gap-4 border border-outline-gray-2 rounded-lg px-5 py-4 flex-wrap"
		>
			<!-- Left: quiz title + date -->
			<div class="flex-1 min-w-0">
				<div
					class="font-semibold text-ink-gray-9 truncate"
					:title="r.quiz_title"
				>
					{{ r.quiz_title }}
				</div>
				<div class="text-sm text-ink-gray-5 mt-0.5">
					{{ formatDate(r.creation) }}
				</div>
			</div>

			<!-- Centre: score -->
			<div class="text-center min-w-16 shrink-0">
				<div
					v-if="r.score != null"
					class="text-2xl font-bold text-ink-blue-3 leading-none"
				>
					{{ r.score }}/{{ r.score_out_of }}
				</div>
				<div
					v-if="r.percentage != null"
					class="text-xs font-semibold mt-0.5"
					:class="r.percentage >= 60 ? 'text-green-600' : 'text-red-500'"
				>
					{{ Math.round(r.percentage) }}%
				</div>
				<div v-if="r.score == null" class="text-ink-gray-4 text-sm">—</div>
			</div>

			<!-- Right: status + action -->
			<div class="flex items-center gap-3 shrink-0">
				<Badge
					v-if="r.status === 'complete'"
					:label="__('Complete')"
					theme="green"
					variant="subtle"
				/>
				<Badge
					v-else-if="['queued', 'processing', 'report_ready'].includes(r.status)"
					:label="__('Processing')"
					theme="orange"
					variant="subtle"
				/>
				<Badge
					v-else
					:label="__('Failed')"
					theme="red"
					variant="subtle"
				/>

				<router-link :to="{ name: 'EdukrutResult', params: { resultName: r.name } }">
					<Button variant="solid" size="sm">
						{{ __('View Analysis') }}
					</Button>
				</router-link>

				<a
					v-if="r.pdf_url"
					:href="r.pdf_url"
					target="_blank"
					rel="noopener"
				>
					<Button variant="outline" size="sm">
						📄 {{ __('PDF') }}
					</Button>
				</a>
			</div>
		</div>
	</div>
</template>

<script setup>
import {
	createResource,
	Breadcrumbs,
	Button,
	Badge,
	LoadingIndicator,
	usePageMeta,
} from 'frappe-ui'
import { computed } from 'vue'

const results = createResource({
	url: 'edukrut_integration.api.get_my_results',
	auto: true,
})

function formatDate(dateStr) {
	if (!dateStr) return ''
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

const breadcrumbs = computed(() => [{ label: __('My Results') }])

usePageMeta(() => ({ title: __('My Results') }))
</script>
