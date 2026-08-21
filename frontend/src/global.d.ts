export {}

declare global {
	function __(text: string): string

	interface String {
		format(...args: any[]): string
	}

	// Set on the page by the server; absent unless the site is in read-only mode.
	interface Window {
		read_only_mode?: boolean
	}
}

declare module 'vue' {
	interface ComponentCustomProperties {
		__: (text: string) => string
	}
}
