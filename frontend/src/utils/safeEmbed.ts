import Embed from '@editorjs/embed'

const EXTERNAL_URL = /^https?:\/\/[^\s\\\u0000-\u001f\u007f]+$/i
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]+$/

// `data.embed` becomes the iframe's src, so only an external http(s) URL is
// framed. YouTube stores a bare video id, which Plyr turns into its own URL.
export const isSafeEmbedSource = (
	service: unknown,
	embed: unknown
): boolean => {
	if (typeof embed !== 'string') return false
	if (service === 'youtube' && YOUTUBE_VIDEO_ID.test(embed)) return true
	if (!EXTERNAL_URL.test(embed)) return false
	try {
		return new URL(embed).hostname !== window.location.hostname
	} catch {
		return false
	}
}

export class SafeEmbed extends Embed {
	render(): HTMLElement {
		const { service, embed } = this.data
		if (isSafeEmbedSource(service, embed)) return super.render()
		this.element = document.createElement('div')
		return this.element
	}
}
