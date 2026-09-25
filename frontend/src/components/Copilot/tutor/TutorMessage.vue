<template>
	<div v-if="message.role === 'user'" class="flex justify-end">
		<div
			class="max-w-[85%] whitespace-pre-wrap break-words rounded-6 bg-surface-gray-3 px-3 py-2 text-p-sm text-ink-gray-9"
		>
			{{ message.text }}
		</div>
	</div>
	<div v-else class="space-y-2" data-testid="tutor-answer">
		<div
			v-if="message.error"
			class="rounded-6 bg-surface-red-1 px-3 py-2 text-p-sm text-ink-red-6"
		>
			{{ message.text }}
		</div>
		<div
			v-else
			v-safe-html:rich="html"
			class="prose prose-sm max-w-none break-words text-ink-gray-9 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:my-2"
		></div>

		<div
			v-if="citations.length"
			class="rounded-5 border px-3 py-2 text-p-xs text-ink-gray-7"
		>
			<div class="mb-1 font-medium text-ink-gray-5">
				{{ __('Sources in this course') }}
			</div>
			<ol class="list-decimal space-y-0.5 ps-4">
				<li v-for="(item, index) in citations" :key="index">
					<router-link
						v-if="item.path"
						:to="item.path"
						class="text-ink-blue-link underline-offset-2 hover:underline"
						:title="__('Open lesson')"
						@click="$emit('navigate')"
					>
						{{ item.label }}
					</router-link>
					<span v-else>{{ item.label }}</span>
				</li>
			</ol>
		</div>

		<div
			v-if="canRate || canEscalate"
			class="flex flex-wrap items-center gap-1.5"
		>
			<template v-if="canRate">
				<Button
					size="sm"
					variant="ghost"
					:label="__('Helpful')"
					:aria-pressed="message.rating === true"
					:class="{ '!bg-surface-gray-3': message.rating === true }"
					:disabled="rating || message.rating != null"
					@click="rate(true)"
				>
					<template #icon>
						<span class="lucide-thumbs-up size-4" />
					</template>
				</Button>
				<Button
					size="sm"
					variant="ghost"
					:label="__('Not helpful')"
					:aria-pressed="message.rating === false"
					:class="{ '!bg-surface-gray-3': message.rating === false }"
					:disabled="rating || message.rating != null"
					@click="rate(false)"
				>
					<template #icon>
						<span class="lucide-thumbs-down size-4" />
					</template>
				</Button>
			</template>
			<Button
				v-if="canEscalate"
				size="sm"
				:variant="tutor.suggest_escalation ? 'subtle' : 'ghost'"
				:loading="escalating"
				:disabled="message.escalated"
				@click="escalate"
			>
				<template #prefix>
					<span class="lucide-message-circle-question size-4" />
				</template>
				{{
					message.escalated ? __('Sent to your teacher') : __('Ask the teacher')
				}}
			</Button>
			<span
				v-if="status"
				class="text-p-xs text-ink-gray-5"
				role="status"
				aria-live="polite"
			>
				{{ status }}
			</span>
		</div>
	</div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Button } from 'frappe-ui'
import MarkdownIt from 'markdown-it'
import { citationPath, escalateToTeacher, rateAnswer } from './gateway'

// html: false — the answer is model output, so raw HTML stays text; the
// directive sanitises what markdown produces on top of that.
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })

const props = defineProps({
	message: { type: Object, required: true },
	sessionId: { type: String, default: '' },
})
const emit = defineEmits(['update', 'navigate'])

const rating = ref(false)
const escalating = ref(false)
const status = ref('')

const tutor = computed(() =>
	props.message.tutor?.kind === 'tutor' ? props.message.tutor : null
)
// The gateway appends "Bài học liên quan: …" as plain text for the old widget;
// here the same lessons are listed as links under the answer.
const RELATED_LINE = /\n+Bài học liên quan: [^\n]*$/
const html = computed(() => {
	const text = props.message.text || ''
	const hasSources =
		Array.isArray(tutor.value?.citations) && tutor.value.citations.length
	return markdown.render(hasSources ? text.replace(RELATED_LINE, '') : text)
})

const citations = computed(() => {
	const items = Array.isArray(tutor.value?.citations)
		? tutor.value.citations
		: []
	return items.map((item) => ({
		label: String(item.label || item.lesson || ''),
		path: citationPath(item.route),
	}))
})

const canRate = computed(() =>
	Boolean(tutor.value?.conversation && tutor.value?.message_index)
)
const canEscalate = computed(() =>
	Boolean(tutor.value?.course && !tutor.value?.escalated)
)

const rate = async (helpful) => {
	rating.value = true
	status.value = ''
	try {
		await rateAnswer({
			conversation: tutor.value.conversation,
			messageIndex: tutor.value.message_index,
			helpful,
		})
		emit('update', { rating: helpful })
		status.value = __('Thanks for your feedback')
	} catch (error) {
		status.value = __('Could not send your rating: {0}').format(error.message)
	} finally {
		rating.value = false
	}
}

const escalate = async () => {
	escalating.value = true
	status.value = ''
	try {
		await escalateToTeacher({
			course: tutor.value.course,
			lesson: tutor.value.lesson,
			question: tutor.value.question || props.message.question || '',
			sessionId: props.sessionId,
		})
		emit('update', { escalated: true })
		status.value = __('Your teacher will answer from the class queue.')
	} catch (error) {
		status.value = __('Could not reach your teacher: {0}').format(error.message)
	} finally {
		escalating.value = false
	}
}
</script>
