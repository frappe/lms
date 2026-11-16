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

/** A file link's extension, ignoring any query or fragment after it. */
export const fileExtension = (url: string): string =>
	url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || ''

/** The MIME type for an audio file's url, so browsers do not skip a wav or m4a labelled mp3. */
export const audioMime = (url: string): string | undefined => {
	const extension = fileExtension(url)
	return Object.hasOwn(AUDIO_MIME, extension)
		? AUDIO_MIME[extension]
		: undefined
}

/** A pasted link to an audio file on any host, such as a Bunny or Cloudflare R2 bucket. */
export const AUDIO_LINK = new RegExp(
	`^https://\\S+\\.(?:${AUDIO_EXTENSIONS.join('|')})(?:[?#]\\S*)?$`,
	'i',
)

/** Encodes a link the browser can load, without encoding one that already is (%20 to %2520). */
export const encodeLink = (url: string): string => {
	try {
		return encodeURI(decodeURI(url))
	} catch {
		return encodeURI(url)
	}
}
