interface EditorBlock {
	type: string
	data: Record<string, unknown>
}

interface LessonBodyData {
	body: string
	youtube?: string
	quizId?: string
}

/**
 * Pull the single quoted argument out of a legacy `{{ Macro("value") }}` line,
 * e.g. `{{ PDF("/files/a.pdf") }}` -> `/files/a.pdf`.
 *
 * Returns null when the line has no quoted argument. Callers MUST handle null:
 * a malformed macro (empty parens, unbalanced quotes) would otherwise make an
 * unguarded `.match(...)[1]` throw and take down the whole render.
 */
export function getMacroArg(block: string): string | null {
	const match = block.match(/\(["']([^"']+?)["']\)/)
	return match ? match[1] : null
}

/**
 * Extract a YouTube video ID from a stored `youtube` field, which may hold a
 * bare ID, a `watch?v=ID` URL, a `youtu.be/ID` short link, or an `/embed/ID`
 * URL. A naive `split('/').pop()` turns `watch?v=ID` into `watch?v=ID` and
 * produces a broken embed, so pull the `v=` param first.
 */
export function extractYoutubeID(url: string): string {
	const watchMatch = url.match(/[?&]v=([^&]+)/)
	if (watchMatch) return watchMatch[1]
	return url.split('/').pop()!.split(/[?#]/)[0]
}

/**
 * Derive a file extension from a media URL, stripping any query string or
 * fragment first: `/files/clip.mp4?v=2` -> `mp4`, not `mp4?v=2` (which would
 * fail the isVideo/isAudio extension checks in utils/upload.js).
 */
export function fileExtension(url: string): string {
	return url.split(/[?#]/)[0].split('.').pop() ?? ''
}

/**
 * Convert a lesson's legacy markdown/macro `body` into EditorJS blocks.
 *
 * Moved out of LessonForm.vue so the macro-to-block mapping is unit-testable.
 * The PDF branch tags the block `file_type: 'PDF'` (uppercase) to match
 * Frappe's File.set_file_type() and the `== 'PDF'` check in utils/upload.js;
 * the previous lowercase 'pdf' fell through to the image branch and rendered
 * legacy PDF lessons as a broken image on every browser.
 *
 * Every macro branch pulls its argument through getMacroArg (guarded) rather
 * than an unchecked `.match(...)[1]`: a stored lesson with a malformed macro
 * (empty parens, unbalanced quotes) must not throw and crash the editor on open.
 */
export function convertBodyToBlocks(lessonData: LessonBodyData): EditorBlock[] {
	let blocks: EditorBlock[] = []
	// Dedupe a video shared by the youtube field and body macro.
	const seenYoutube = new Set<string>()
	const youtubeKey = (url: string) => url.split('/').pop()!.split('?')[0]
	const pushYoutube = (embedUrl: string) => {
		const key = youtubeKey(embedUrl)
		if (seenYoutube.has(key)) return
		seenYoutube.add(key)
		blocks.push({
			type: 'embed',
			data: { service: 'youtube', embed: embedUrl },
		})
	}
	if (lessonData.youtube) {
		let youtubeID = extractYoutubeID(lessonData.youtube)
		pushYoutube(`https://www.youtube.com/embed/${youtubeID}`)
	}
	lessonData.body.split('\n').forEach((block) => {
		if (block.includes('{{ YouTubeVideo')) {
			let youtubeID = getMacroArg(block) ?? ''
			if (!youtubeID.includes('https://'))
				youtubeID = `https://www.youtube.com/embed/${youtubeID}`
			pushYoutube(youtubeID)
		} else if (block.includes('{{ Quiz')) {
			let quiz = getMacroArg(block) ?? ''
			blocks.push({
				type: 'quiz',
				data: {
					quiz: quiz,
				},
			})
		} else if (block.includes('{{ Video')) {
			let video = getMacroArg(block) ?? ''
			blocks.push({
				type: 'upload',
				data: {
					file_url: video,
					file_type: fileExtension(video),
				},
			})
		} else if (block.includes('{{ Audio')) {
			let audio = getMacroArg(block) ?? ''
			blocks.push({
				type: 'upload',
				data: {
					file_url: audio,
					file_type: fileExtension(audio),
				},
			})
		} else if (block.includes('{{ PDF')) {
			let pdf = getMacroArg(block) ?? ''
			blocks.push({
				type: 'upload',
				data: {
					file_url: pdf,
					file_type: 'PDF',
				},
			})
		} else if (block.includes('{{ Embed')) {
			let embed = getMacroArg(block) ?? ''
			blocks.push({
				type: 'embed',
				data: {
					service: embed.split('|||')[0],
					embed: embed.split('|||')[1],
				},
			})
		} else if (block.includes('![]')) {
			let image = block.match(/\((.*?)\)/)?.[1] ?? ''
			blocks.push({
				type: 'upload',
				data: {
					file_url: image,
					file_type: 'image',
				},
			})
		} else if (/^#+/.test(block)) {
			let level = block.match(/^#+/)![0].length
			blocks.push({
				type: 'header',
				data: {
					text: block.replace(/^#+/, '').trim(),
					level: level,
				},
			})
		} else {
			blocks.push({
				type: 'paragraph',
				data: {
					text: block,
				},
			})
		}
	})

	if (lessonData.quizId) {
		blocks.push({
			type: 'quiz',
			data: {
				quiz: lessonData.quizId,
			},
		})
	}

	return blocks
}
