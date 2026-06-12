import { io } from 'socket.io-client'
import { socketio_port } from '../../../../sites/common_site_config.json'

export function initSocket() {
	let port = window.location.port
	let isSameOrigin = !port || port === '80' || port === '443'
	let url = isSameOrigin
		? window.location.origin
		: `${window.location.protocol}//${window.location.hostname}:${socketio_port}`

	let socket = io(url, {
		path: '/socket.io/',
		withCredentials: true,
		reconnectionAttempts: 5,
	})
	return socket
}
