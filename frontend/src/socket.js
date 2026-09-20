import { io } from 'socket.io-client'

const socketioPort = import.meta.env.VITE_SOCKETIO_PORT || 9000

export function initSocket() {
	let host = window.location.hostname
	let siteName = window.site_name || host
	let port = window.location.port ? `:${socketioPort}` : ''
	let protocol = window.location.protocol === 'https:' ? 'https' : 'http'
	let url = `${protocol}://${host}${port}/${siteName}`

	let socket = io(url, {
		withCredentials: true,
		reconnectionAttempts: 5,
	})
	return socket
}
