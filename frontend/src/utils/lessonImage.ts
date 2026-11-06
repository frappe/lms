// @ts-expect-error @editorjs/simple-image ships no type declarations
import SimpleImage from '@editorjs/simple-image'

// A pasted image link: a file ending in an image extension, with or without a query
// (Bunny Optimizer adds ?width=), or a Cloudflare Images delivery link, which ends in
// a variant name instead of an extension.
export const IMAGE_LINK =
	/^https?:\/\/(?:\S+\.(?:gif|jpe?g|tiff|png|webp|avif)(?:[?#]\S*)?|imagedelivery\.net\/[\w-]+\/[\w-]+\/[\w=,.-]+|[\w.-]+\/cdn-cgi\/imagedelivery\/[\w-]+\/[\w-]+\/[\w=,.-]+)$/i

/** Simple Image, recognising the image links lessons are given in practice. */
export default class LessonImage extends SimpleImage {
	static get pasteConfig() {
		return { ...super.pasteConfig, patterns: { image: IMAGE_LINK } }
	}
}
