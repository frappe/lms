
export type Note = {
	highlighted_text?: string
	color?: string
	name: string
    note?: string | null
    lesson?: string
    member?: string
}

export type Notes = {
	data: Note[]
	reload: () => void
    insert: {
        submit: (
            data: Note,
            options: { onSuccess: (data: Note) => void; onError: (err: any) => void }
        ) => void
    }
    setValue: {
        submit: (
            data: Note,
            options: { onSuccess: (data: Note) => void; onError: (err: any) => void }
        ) => void
    },
    delete: {
        submit: (
            data: Note | string,
            options?: { onSuccess: () => void; onError: (err: any) => void }
        ) => void
    }
}