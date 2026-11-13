import type { FrappeResourceError } from 'frappe-ui'

export type Note = {
	highlighted_text?: string
	color?: string
	name: string
	note?: string | null
	lesson?: string
	member?: string
}

export type Notes = {
	data: Note[] | null
	reload: () => void
	insert: {
		loading: boolean
		submit: (
			data: Note,
			options: {
				onSuccess: (data: Note) => void
				onError: (err: FrappeResourceError) => void
			}
		) => void
	}
	setValue: {
		loading: boolean
		submit: (
			data: Note,
			options: {
				onSuccess: (data: Note) => void
				onError: (err: FrappeResourceError) => void
			}
		) => void
	}
	delete: {
		loading: boolean
		submit: (
			data: Note | string,
			options?: {
				onSuccess: () => void
				onError: (err: FrappeResourceError) => void
			}
		) => void
	}
}
