<template>
	<div v-if="youtubeEmbedId(youtube)" :key="youtubeEmbedId(youtube)">
		<div
			class="video-player"
			data-plyr-provider="youtube"
			:data-plyr-embed-id="youtubeEmbedId(youtube)"
		></div>
	</div>
	<!-- Keyed on the block text, not just the index: position N of the outgoing
	     lesson and position N of the incoming one share an index, so Vue reuses
	     the instance and hands a <PdfBlock> a new `file`, which it only reads
	     once, at setup. Including the text forces a fresh instance. -->
	<div
		v-for="(block, index) in content?.split('\n\n')"
		:key="`${index}:${block}`"
	>
		<div v-if="block.includes('{{ YouTubeVideo')">
			<div
				v-if="youtubeEmbedId(getId(block))"
				:key="youtubeEmbedId(getId(block))"
				class="video-player"
				data-plyr-provider="youtube"
				:data-plyr-embed-id="youtubeEmbedId(getId(block))"
			></div>
		</div>
		<div v-else-if="block.includes('{{ Quiz')">
			<Quiz :quiz="getId(block)" />
		</div>
		<div v-else-if="block.includes('{{ Video')">
			<video
				controls
				width="100%"
				controlsList="nodownload"
				oncontextmenu="return false;"
			>
				<source :src="safeUrl(getId(block))" type="video/mp4" />
			</video>
		</div>
		<div v-else-if="block.includes('{{ PDF')">
			<PdfBlock v-if="inlinePdf" :file="getId(block)" />
			<iframe
				v-else
				:src="safeUrl(getId(block))"
				:title="__('PDF document')"
				width="100%"
				height="700px"
				class="mb-4"
				type="application/pdf"
			></iframe>
		</div>
		<div v-else-if="block.includes('{{ Audio')">
			<audio width="100%" controls controlsList="nodownload">
				<source :src="safeUrl(getId(block))" type="audio/mp3" />
			</audio>
		</div>
		<div v-else-if="block.includes('{{ Embed')">
			<iframe
				width="100%"
				height="400"
				:src="safeUrl(getId(block))"
				:title="__('Embedded content')"
				frameborder="0"
				allowfullscreen
			>
			</iframe>
		</div>
		<div v-else v-safe-html:rich="renderMarkdown(block)"></div>
	</div>
	<div v-if="quizId">
		<Quiz :quiz="quizId" />
	</div>
</template>
<script setup>
import Quiz from '@/components/QuizBlock.vue'
import PdfBlock from '@/components/PdfBlock.vue'
import MarkdownIt from 'markdown-it'
import { extractYoutubeID, getMacroArg } from '@/utils/lessonMacros'
import { usesWebkitPdfViewer } from '@/utils/pdfViewer'
import { safeUrl } from '@/utils/safeUrl'

const inlinePdf = usesWebkitPdfViewer()

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
})

// The directive sanitizes at the rich level, which is where the anchor-target
// hook and the form-tag blocklist live. This only does the markdown pass.
const renderMarkdown = (block) => markdown.render(block)

const props = defineProps({
	content: {
		type: String,
		required: true,
	},
	youtube: {
		type: String,
		required: false,
	},
	quizId: {
		type: String,
		required: false,
	},
})

const getId = (block) => {
	// Guard the match: a malformed `{{ PDF() }}` / unbalanced-quote macro yields
	// null, and the old unguarded [1] threw and killed the whole lesson render.
	return getMacroArg(block) ?? ''
}

// Both authoring paths (the `youtube` field and the `{{ YouTubeVideo }}` macro)
// must land in the same Plyr-wrapped `.video-player` the EditorJS embed block
// renders. A bare <iframe> is invisible to the watch tracker in Lesson.vue, so
// enforce_video_completion saw "no video" and auto-completed on the dwell timer.
// Falsy id => render nothing rather than a Plyr player with no video, which
// would suppress the dwell timer and leave the lesson uncompletable.
const youtubeEmbedId = (source) => (source ? extractYoutubeID(source) : '')
</script>
