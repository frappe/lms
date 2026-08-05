<template>
	<div v-if="youtube">
		<iframe
			class="youtube-video"
			:src="getYouTubeVideoSource(youtube.split('/').pop())"
			:title="__('YouTube video')"
			width="100%"
			:height="screenSize.width < 640 ? 200 : 400"
			frameborder="0"
			allowfullscreen
		></iframe>
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
			<iframe
				class="youtube-video"
				:src="getYouTubeVideoSource(block)"
				:title="__('YouTube video')"
				width="100%"
				:height="screenSize.width < 640 ? 200 : 400"
				frameborder="0"
				allowfullscreen
			></iframe>
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
				<source :src="getId(block)" type="video/mp4" />
			</video>
		</div>
		<div v-else-if="block.includes('{{ PDF')">
			<PdfBlock v-if="inlinePdf" :file="getId(block)" />
			<iframe
				v-else
				:src="getId(block)"
				:title="__('PDF document')"
				width="100%"
				height="700px"
				class="mb-4"
				type="application/pdf"
			></iframe>
		</div>
		<div v-else-if="block.includes('{{ Audio')">
			<audio width="100%" controls controlsList="nodownload">
				<source :src="getId(block)" type="audio/mp3" />
			</audio>
		</div>
		<div v-else-if="block.includes('{{ Embed')">
			<iframe
				width="100%"
				height="400"
				:src="getId(block)"
				:title="__('Embedded content')"
				frameborder="0"
				allowfullscreen
			>
			</iframe>
		</div>
		<div v-else v-html="renderSafe(block)"></div>
	</div>
	<div v-if="quizId">
		<Quiz :quiz="quizId" />
	</div>
</template>
<script setup>
import Quiz from '@/components/QuizBlock.vue'
import PdfBlock from '@/components/PdfBlock.vue'
import MarkdownIt from 'markdown-it'
import { useScreenSize } from '@/utils/composables'
import { getMacroArg } from '@/utils/lessonMacros'
import { sanitizeRichHTML } from '@/utils/sanitizeRichHTML'
import { usesWebkitPdfViewer } from '@/utils/pdfViewer'

const screenSize = useScreenSize()
const inlinePdf = usesWebkitPdfViewer()

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
})

// Route markdown output through the shared sanitizer so the anchor-target
// hook (open in new tab) and form-tag blocklist are applied uniformly with
// the rest of the LMS render pipelines. Keeps one source of truth for what
// counts as safe user-authored HTML.
const renderSafe = (block) => sanitizeRichHTML(markdown.render(block))

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

const getYouTubeVideoSource = (block) => {
	if (block.includes('{{')) {
		block = getId(block)
	}
	return `https://www.youtube.com/embed/${block}`
}

const getId = (block) => {
	// Guard the match: a malformed `{{ PDF() }}` / unbalanced-quote macro yields
	// null, and the old unguarded [1] threw and killed the whole lesson render.
	return getMacroArg(block) ?? ''
}
</script>
