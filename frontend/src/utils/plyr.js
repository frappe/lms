import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useSettings } from '@/stores/settings'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const enablePlyr = async () => {
	await wait(500)

	const players = []
	const videoElements = document.getElementsByClassName('video-player')

	if (videoElements.length === 0) return players

	Array.from(videoElements).forEach((video) => {
		setupPlyrForVideo(video, players)
	})

	return players
}

const setupPlyrForVideo = (video, players) => {
	// Guard against double-initialisation. enablePlyr() runs on several triggers
	// (editor onChange, lesson render) and can race, so the same .video-player
	// element may be processed more than once — a second Plyr stacks a duplicate
	// player and you see two sets of controls. Reuse the existing instance.
	if (video.plyrInstance) {
		players.push(video.plyrInstance)
		return
	}

	const src = video.getAttribute('src')

	if (src) {
		const videoID = extractYouTubeId(src)
		video.setAttribute('data-plyr-embed-id', videoID)
	}

	// No 'play-large' (the big centre overlay): it duplicates the control-bar
	// play/pause — the overlay persists while paused and the bar shows on hover,
	// which reads as two pause buttons. The video stays click-to-play.
	let controls = [
		'play',
		'progress',
		'current-time',
		'mute',
		'volume',
		'settings',
		'fullscreen',
	]

	const player = new Plyr(video, {
		youtube: { noCookie: true },
		controls: controls,
		settings: ['speed'],
		speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
		listeners: {
			seek: function customSeekBehavior(e) {
				const current_time = player.currentTime
				const newTime = getTargetTime(player, e)
				if (
					useSettings().settings.data?.prevent_skipping_videos &&
					parseFloat(newTime) > current_time
				) {
					e.preventDefault()
					player.currentTime = current_time
					return false
				}
			},
		},
	})

	video.plyrInstance = player
	players.push(player)
}

const getTargetTime = (plyr, input) => {
	if (
		typeof input === 'object' &&
		(input.type === 'input' || input.type === 'change')
	) {
		return (input.target.value / input.target.max) * plyr.duration
	} else {
		return Number(input)
	}
}

const extractYouTubeId = (url) => {
	try {
		const parsedUrl = new URL(url)
		return (
			parsedUrl.searchParams.get('v') ||
			parsedUrl.pathname.split('/').pop()
		)
	} catch {
		return url.split('/').pop()
	}
}
