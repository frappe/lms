<template>
	<div>
		<div
			class="mb-4 flex flex-wrap gap-1 border-b border-outline-gray-2"
			role="tablist"
		>
			<button
				v-for="tab in tabs"
				:key="tab.id"
				type="button"
				role="tab"
				:aria-selected="current === tab.id ? 'true' : 'false'"
				class="-mb-px border-b-2 px-3 py-2 text-p-base"
				:class="
					current === tab.id
						? 'border-outline-gray-5 text-ink-gray-9'
						: 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
				"
				@click="select(tab.id)"
			>
				{{ tab.label }}
			</button>
		</div>

		<div v-if="current === 'code'" class="space-y-3">
			<div class="flex flex-wrap items-center gap-2 text-p-sm">
				<a
					:href="safeUrl(submission.repo_url)"
					v-external
					class="break-all text-ink-gray-7 underline"
				>
					{{ submission.repo_url }}
				</a>
				<span class="flex-1" />
				<select
					v-if="files.length > 1"
					v-model="file"
					class="form-select h-7 rounded border-outline-gray-2 bg-surface-gray-2 py-0 text-p-sm"
					:aria-label="__('File')"
					@change="citation = null"
				>
					<option v-for="path in files" :key="path" :value="path">
						{{ path }}
					</option>
				</select>
			</div>
			<p v-if="!file" class="text-p-base text-ink-gray-5">
				{{
					__('The draft cites no files. Open the repository to read the code.')
				}}
			</p>
			<template v-else>
				<div class="flex items-center gap-2 text-p-sm">
					<code class="truncate text-ink-gray-8">{{ file }}</code>
					<span class="flex-1" />
					<a
						:href="safeUrl(githubUrl)"
						v-external
						class="shrink-0 text-ink-gray-7 underline"
					>
						{{ __('Open on GitHub') }}
					</a>
				</div>
				<div
					ref="codeBox"
					class="max-h-[32rem] overflow-auto rounded border border-outline-gray-2 bg-surface-gray-1 py-2 font-mono text-p-sm"
					data-testid="copilot-code"
				>
					<p v-if="fileState === 'loading'" class="px-3 text-ink-gray-5">
						{{ __('Loading {0}…').format(file) }}
					</p>
					<p v-else-if="fileState === 'error'" class="px-3 text-ink-gray-5">
						{{
							__(
								'Could not load this file from GitHub. The repository may be private or the file moved.'
							)
						}}
					</p>
					<template v-else>
						<div
							v-for="(line, index) in lines"
							:key="index"
							:data-line="index + 1"
							class="flex whitespace-pre px-3"
							:class="isCited(index + 1) ? 'bg-surface-amber-2' : ''"
						>
							<span
								class="me-3 inline-block w-10 shrink-0 select-none text-end text-ink-gray-4"
								>{{ index + 1 }}</span
							><span class="text-ink-gray-8">{{ line }}</span>
						</div>
					</template>
				</div>
			</template>
		</div>

		<TeacherTestList
			v-else-if="current === 'tests'"
			:tests="submission.tests"
		/>

		<div v-else-if="current === 'history'" class="overflow-x-auto">
			<table class="w-full text-p-base">
				<tbody>
					<tr
						v-for="row in submission.history || []"
						:key="row.name"
						class="border-b border-outline-gray-1"
					>
						<td class="py-2 pe-3 text-ink-gray-7">
							{{ formatDate(row.creation) }}
						</td>
						<td class="py-2 pe-3 font-mono text-ink-gray-7">
							{{ row.commit_sha ? row.commit_sha.slice(0, 7) : '—' }}
						</td>
						<td class="py-2 pe-3 text-ink-gray-7">
							{{ (row.tests_passed || 0) + '/' + (row.tests_total || 0) }}
						</td>
						<td class="py-2"><TeacherStatusBadge :status="row.status" /></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { safeUrl } from '@/utils/safeUrl'
import TeacherTestList from './TeacherTestList.vue'
import TeacherStatusBadge from './TeacherStatusBadge.vue'
import {
	citedFiles,
	citedRanges,
	formatDate,
	githubLine,
	rawFileUrl,
} from './format'

const props = defineProps({
	submission: { type: Object, required: true },
	scores: { type: Array, default: () => [] },
})

const files = computed(() => citedFiles(props.scores))
const current = ref(files.value.length ? 'code' : 'tests')
const file = ref(files.value[0] || null)
const citation = ref(null)
const lines = ref([])
const fileState = ref('idle')
const codeBox = ref(null)

const tabs = computed(() => {
	const tests = props.submission.tests || {}
	return [
		{ id: 'code', label: __('Code') },
		{
			id: 'tests',
			label: __('Test results ({0}/{1})').format(
				tests.passed || 0,
				tests.total || 0
			),
		},
		{ id: 'history', label: __('Submission history') },
	]
})

const ranges = computed(() => citedRanges(props.scores, file.value))

const githubUrl = computed(() =>
	githubLine(props.submission, {
		file: file.value,
		line_start: citation.value?.line_start,
		line_end: citation.value?.line_end,
	})
)

function isCited(number) {
	return ranges.value.some(([start, end]) => number >= start && number <= end)
}

// Shared across drafts: the same commit's file never changes.
const cache = new Map()

function fetchFile(url) {
	if (!cache.has(url)) {
		const request = fetch(url, { credentials: 'omit' }).then((response) =>
			response.ok
				? response.text()
				: Promise.reject(new Error(String(response.status)))
		)
		request.catch(() => cache.delete(url))
		cache.set(url, request)
	}
	return cache.get(url)
}

let loadTicket = 0
async function loadFile() {
	if (current.value !== 'code' || !file.value) return
	const ticket = ++loadTicket
	const url = rawFileUrl(props.submission, file.value)
	fileState.value = 'loading'
	try {
		if (!url) throw new Error('repo')
		const text = await fetchFile(url)
		if (ticket !== loadTicket) return
		lines.value = text.split('\n')
		fileState.value = 'ready'
		await nextTick()
		scrollToCitation()
	} catch (error) {
		if (ticket !== loadTicket) return
		fileState.value = 'error'
	}
}

function scrollToCitation() {
	const start = citation.value?.line_start
	if (!start || !codeBox.value) return
	const target = codeBox.value.querySelector(`[data-line="${start}"]`)
	if (target?.scrollIntoView) target.scrollIntoView({ block: 'center' })
}

function select(id) {
	current.value = id
}

function show(cited) {
	citation.value = cited
	current.value = 'code'
	if (file.value === cited.file && fileState.value === 'ready') {
		nextTick(scrollToCitation)
		return
	}
	file.value = cited.file
}

watch([current, file], loadFile, { immediate: true })

defineExpose({ show })
</script>
