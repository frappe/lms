import {
	computed,
	onMounted,
	onUnmounted,
	reactive,
	ref,
	watch,
	type ComputedRef,
	type Ref,
} from 'vue'

/** Tailwind's `sm`. The one place the phone/desktop cutoff is written down. */
export const MOBILE_BREAKPOINT = 640

export interface ScreenSize {
	width: number
	height: number
}

export function useScreenSize(): {
	size: ScreenSize
	isMobile: ComputedRef<boolean>
} {
	const size = reactive<ScreenSize>({
		width: window.innerWidth,
		height: window.innerHeight,
	})

	const isMobile = computed(() => size.width < MOBILE_BREAKPOINT)

	const onResize = (): void => {
		size.width = window.innerWidth
		size.height = window.innerHeight
	}

	onMounted(() => {
		window.addEventListener('resize', onResize)
	})

	onUnmounted(() => {
		window.removeEventListener('resize', onResize)
	})

	return {
		size,
		isMobile,
	}
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface SwipeState {
	initialX: number | null
	initialY: number | null
	currentX: number | null
	currentY: number | null
	diffX: number | null
	diffY: number | null
	absDiffX: number | null
	absDiffY: number | null
	direction: SwipeDirection | null
}

export function useSwipe(): SwipeState {
	const swipe = reactive<SwipeState>({
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

	const onTouchStart = (e: TouchEvent): void => {
		swipe.initialX = e.touches[0].clientX
		swipe.initialY = e.touches[0].clientY
		swipe.direction = null
		swipe.diffX = null
		swipe.diffY = null
		swipe.absDiffX = null
		swipe.absDiffY = null
	}

	const onTouchMove = (e: TouchEvent): void => {
		// A move without a start has no origin to measure against. Untyped, the
		// subtraction below quietly produced NaN and onTouchEnd then reported a
		// direction of 'down' for it.
		if (swipe.initialX === null || swipe.initialY === null) return

		swipe.currentX = e.touches[0].clientX
		swipe.currentY = e.touches[0].clientY

		swipe.diffX = swipe.initialX - swipe.currentX
		swipe.diffY = swipe.initialY - swipe.currentY

		swipe.absDiffX = Math.abs(swipe.diffX)
		swipe.absDiffY = Math.abs(swipe.diffY)
	}

	const onTouchEnd = (): void => {
		const { diffX, diffY, absDiffX, absDiffY } = swipe
		if (diffX === null || diffY === null) return
		if (absDiffX === null || absDiffY === null) return

		if (absDiffX > absDiffY) {
			swipe.direction = diffX > 0 ? 'left' : 'right'
		} else {
			swipe.direction = diffY > 0 ? 'up' : 'down'
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

export function useLocalStorage<T>(key: string, initialValue: T): Ref<T> {
	const storedValue = localStorage.getItem(key)
	const value = ref(
		storedValue ? (JSON.parse(storedValue) as T) : initialValue
	) as Ref<T>

	watch(value, (newValue) => {
		localStorage.setItem(key, JSON.stringify(newValue))
	})
	return value
}
