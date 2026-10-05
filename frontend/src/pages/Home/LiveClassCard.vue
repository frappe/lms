<template>
	<div class="mt-auto text-ink-gray-7">
		<div class="flex items-center gap-x-2">
			<span class="lucide-calendar size-4" />
			<span>
				{{ dayjs(cls.date).format('DD MMMM YYYY') }}
			</span>
		</div>
		<div class="flex items-center gap-x-2">
			<span class="lucide-clock size-4" />
			<span>
				{{ formatTime(cls.time) }} -
				{{ dayjs(getClassEnd(cls)).format('HH:mm A') }}
			</span>
		</div>
		<div
			v-if="canAccessClass(cls)"
			class="flex items-center gap-x-2 text-ink-gray-9 mt-auto"
		>
			<a
				v-if="user.data?.is_moderator || user.data?.is_evaluator"
				:href="safeUrl(cls.start_url)"
				v-external
				class="cursor-pointer inline-flex items-center justify-center gap-2 transition-colors text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 h-7 text-base px-2 rounded-4"
				:class="cls.join_url ? 'w-full' : 'w-1/2'"
			>
				<span class="lucide-monitor size-4" />
				{{ __('Start') }}
			</a>
			<a
				:href="safeUrl(cls.join_url)"
				v-external
				class="w-full cursor-pointer inline-flex items-center justify-center gap-2 transition-colors text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 h-7 text-base px-2 rounded-4"
			>
				<span class="lucide-video size-4" />
				{{ __('Join') }}
			</a>
		</div>
		<Tooltip
			v-else-if="hasClassEnded(cls)"
			:text="__('This class has ended')"
			side="right"
		>
			<div class="flex items-center gap-x-2 w-fit" :class="endedClass">
				<span class="lucide-info size-4" />
				<span>
					{{ __('Ended') }}
				</span>
			</div>
		</Tooltip>
	</div>
</template>
<script setup lang="ts">
import { inject } from 'vue'
import { Tooltip } from 'frappe-ui'
import { formatTime } from '@/utils'
import { safeUrl } from '@/utils/safeUrl'

type LiveClassTiming = { date: string; time: string; duration: number }

defineProps<{
	cls: LiveClassTiming & { start_url?: string; join_url?: string }
	endedClass: string
}>()

const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')

const getClassEnd = (cls: LiveClassTiming) => {
	const classStart = new Date(`${cls.date}T${cls.time}`)
	return new Date(classStart.getTime() + cls.duration * 60000)
}

const canAccessClass = (cls: LiveClassTiming) =>
	cls.date === dayjs().format('YYYY-MM-DD') && !hasClassEnded(cls)

const hasClassEnded = (cls: LiveClassTiming) => new Date() > getClassEnd(cls)
</script>
