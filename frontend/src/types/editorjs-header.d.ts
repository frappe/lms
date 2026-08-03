// @editorjs/header ships no type declarations. Declare only the surface our
// Heading subclass touches (see utils/heading.ts), including the two API
// members the base tool reads, so a test can construct one without a cast.
declare module '@editorjs/header' {
	export interface HeaderData {
		text: string
		level: number
	}

	export interface HeaderConfig {
		placeholder?: string
		levels?: number[]
		defaultLevel?: number
	}

	export interface HeaderApi {
		styles: { block: string }
		i18n: { t: (text: string) => string }
	}

	export default class Header {
		constructor(options: {
			data: Partial<HeaderData>
			config: HeaderConfig
			api: HeaderApi
			readOnly: boolean
		})
		getTag(): HTMLElement
		render(): HTMLElement
		merge(data: Partial<HeaderData>): void
		setLevel(level: number): void
	}
}
