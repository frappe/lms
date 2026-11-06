// The audio a lesson can play, by file extension, and the type its player declares.
const AUDIO_MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
}

export const AUDIO_EXTENSIONS = Object.keys(AUDIO_MIME)

export const isAudioType = (type: string | null | undefined): boolean =>
	!!type && Object.hasOwn(AUDIO_MIME, type.toLowerCase())

/** The MIME type for an audio file's url, so browsers do not skip a wav or m4a labelled mp3. */
export const audioMime = (url: string): string | undefined => {
	const extension = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || ''
	return Object.hasOwn(AUDIO_MIME, extension) ? AUDIO_MIME[extension] : undefined
}
