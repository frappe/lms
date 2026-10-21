// @editorjs/embed ships no type declarations. Declare only the surface the
// SafeEmbed subclass touches (see utils/safeEmbed.ts).
declare module '@editorjs/embed' {
	export interface EmbedData {
		service?: string
		source?: string
		embed?: string
		caption?: string
	}

	export default class Embed {
		constructor(options: { data: EmbedData; api: unknown; readOnly: boolean })
		element: HTMLElement | null
		get data(): EmbedData
		set data(data: EmbedData)
		render(): HTMLElement
		static prepare(options: { config?: unknown }): void
	}
}
