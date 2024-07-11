import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'

export function useScreenSize() {
	const size = reactive({
		width: window.innerWidth,
		height: window.innerHeight,
	})

	const onResize = () => {
		size.width = window.innerWidth
		size.height = window.innerHeight
	}

	onMounted(() => {
		window.addEventListener('resize', onResize)
	})

	onUnmounted(() => {
		window.removeEventListener('resize', onResize)
	})

	return size
}
// write a composable for detecting swipe gestures in mobile devices
export function useSwipe() {
	const swipe = reactive({
		initialX: null,
		initialY: null,
		currentX: null,
		currentY: null,
		diffX: null,
		diffY: null,
		absDiffX: null,
		absDiffY: null,
		direction: null,
	})

	const onTouchStart = (e) => {
		swipe.initialX = e.touches[0].clientX
		swipe.initialY = e.touches[0].clientY
		swipe.direction = null
		swipe.diffX = null
		swipe.diffY = null
		swipe.absDiffX = null
		swipe.absDiffY = null
	}

	const onTouchMove = (e) => {
		swipe.currentX = e.touches[0].clientX
		swipe.currentY = e.touches[0].clientY

		swipe.diffX = swipe.initialX - swipe.currentX
		swipe.diffY = swipe.initialY - swipe.currentY

		swipe.absDiffX = Math.abs(swipe.diffX)
		swipe.absDiffY = Math.abs(swipe.diffY)
	}

	const onTouchEnd = (e) => {
		let { diffX, diffY, absDiffX, absDiffY } = swipe
		if (absDiffX > absDiffY) {
			if (diffX > 0) {
				swipe.direction = 'left'
			} else {
				swipe.direction = 'right'
			}
		} else {
			if (diffY > 0) {
				swipe.direction = 'up'
			} else {
				swipe.direction = 'down'
			}
		}
	}

	onMounted(() => {
		window.addEventListener('touchstart', onTouchStart)
		window.addEventListener('touchend', onTouchEnd)
		window.addEventListener('touchmove', onTouchMove)
	})

	onUnmounted(() => {
		window.removeEventListener('touchstart', onTouchStart)
		window.removeEventListener('touchend', onTouchEnd)
		window.removeEventListener('touchmove', onTouchMove)
	})

	return swipe
}

export function useLocalStorage(key, initialValue) {
	let value = ref(null)
	let storedValue = localStorage.getItem(key)
	value.value = storedValue ? JSON.parse(storedValue) : initialValue

	watch(value, (newValue) => {
		localStorage.setItem(key, JSON.stringify(newValue))
	})
	return value
}
