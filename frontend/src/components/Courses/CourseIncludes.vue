<template>
	<section v-if="facts.length" class="space-y-2.5 text-p-sm text-ink-gray-7">
		<div class="text-p-sm-medium text-ink-gray-9">
			{{ __('This course includes:') }}
		</div>
		<div v-for="fact in facts" :key="fact.icon" class="flex items-center gap-2">
			<span class="size-4 shrink-0" :class="fact.icon" />
			<span>{{ fact.label }}</span>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** The facts list under the enrol button. Shows only what the course has. */
const props = defineProps<{
	enrollments?: number
	lessons?: number
	quizzes?: number
	hasVideo?: boolean
	certificate?: 'free' | 'paid' | null
}>()

interface Fact {
	icon: string
	label: string
}

function roundedCount(count: number): string {
	if (count < 50) return String(count)
	const tier = count < 1000 ? 50 : 100
	return `${Math.floor(count / tier) * tier}+`
}

function plural(count: number, one: string, many: string): string {
	return count === 1 ? one : many.format(count)
}

const facts = computed<Fact[]>(() => {
	const list: Fact[] = []
	if (props.enrollments) {
		list.push({
			icon: 'lucide-users-round',
			label: __('{0} enrolled').format(roundedCount(props.enrollments)),
		})
	}
	if (props.hasVideo) {
		list.push({
			icon: 'lucide-monitor-play',
			label: __('On demand course video'),
		})
	}
	if (props.lessons) {
		list.push({
			icon: 'lucide-book-open',
			label: plural(props.lessons, __('1 lesson'), __('{0} lessons')),
		})
	}
	if (props.quizzes) {
		list.push({
			icon: 'lucide-circle-help',
			label: plural(props.quizzes, __('1 quiz'), __('{0} quizzes')),
		})
	}
	if (props.certificate) {
		list.push({
			icon: 'lucide-award',
			label:
				props.certificate === 'paid'
					? __('Paid certificate')
					: __('Certificate of completion'),
		})
	}
	return list
})
</script>
