<template>
	<div v-if="!showsEmptyState">
		<Button
			v-if="!singleThread && !readOnlyMode"
			class="float-end"
			@click="openTopicModal()"
		>
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
			{{ __('New {0}').format(singularize(title)) }}
		</Button>
		<div class="text-2xl-semibold text-ink-gray-9">
			{{ __(title) }}
		</div>
	</div>
	<div
		v-if="topics.data?.length && !singleThread"
		class="mt-2 md:flex md:gap-5"
	>
		<!-- Master: topic list (always visible at md+; hidden on mobile while a
		     topic thread is open) -->
		<ul
			class="md:w-2/5 md:shrink-0 md:max-h-[60vh] md:overflow-y-auto md:border-e md:pe-5 list-none"
			:class="{ 'hidden md:block': currentTopic }"
		>
			<li v-for="(topic, index) in topics.data" :key="topic.name">
				<button
					type="button"
					data-testid="topic-row"
					@click="showReplies(topic)"
					class="flex items-center cursor-pointer py-4 px-2 rounded-5 w-full text-start"
					:class="[
						{ 'border-b': index + 1 != topics.data.length },
						currentTopic?.name === topic.name ? 'bg-surface-gray-2' : '',
					]"
				>
					<UserAvatar :user="topic.user" size="xl" class="me-3" />
					<div class="min-w-0">
						<div class="text-base-semibold mb-1 text-ink-gray-7 truncate">
							{{ topic.title }}
						</div>
						<div class="flex items-center text-ink-gray-6">
							<span class="text-sm">
								{{ timeAgo(topic.creation) }}
							</span>
							<span class="flex items-center gap-1 text-sm ms-3">
								<span class="lucide-message-square size-3.5" />
								{{
									(topic.reply_count === 1
										? __('{0} reply')
										: __('{0} replies')
									).format(topic.reply_count || 0)
								}}
							</span>
						</div>
					</div>
				</button>
			</li>
		</ul>
		<!-- Detail: selected topic's thread -->
		<div class="flex-1 min-w-0">
			<DiscussionReplies
				v-if="currentTopic"
				:key="currentTopic.name"
				:topic="currentTopic"
				:doctype="props.doctype"
				:docname="props.docname"
				v-model:showTopics="showTopics"
			/>
		</div>
	</div>
	<div v-else-if="singleThread && topics.data">
		<DiscussionReplies
			:topic="topics.data"
			:singleThread="singleThread"
			:doctype="props.doctype"
			:docname="props.docname"
		/>
	</div>
	<EmptyStateLayout
		v-else-if="singleThread && topics.error"
		class="min-h-[60vh]"
		name="Discussions"
		icon="lucide-message-circle"
		width="lg"
		:title="__('This discussion did not load')"
		:description="
			__(
				'Reload to try again. If it still does not load, ask your site administrator to check the error log.'
			)
		"
	>
		<Button :label="__('Reload')" @click="topics.reload()" />
	</EmptyStateLayout>
	<!-- Sits under a lesson, so it stays compact rather than filling the view. -->
	<EmptyStateLayout
		v-else-if="!singleThread && topics.data"
		class="!min-h-0 py-10"
		name="Discussions"
		icon="lucide-message-circle"
		width="lg"
		:title="
			emptyStateTitle
				? __(emptyStateTitle)
				: __('No {0} yet').format(__(title).toLowerCase())
		"
		:description="__(emptyStateText)"
	>
		<Button v-if="!readOnlyMode" variant="solid" @click="openTopicModal()">
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
			{{ __('New {0}').format(singularize(title)) }}
		</Button>
	</EmptyStateLayout>
	<DiscussionModal
		v-model="showTopicModal"
		:title="__('New {0}').format(title)"
		:doctype="props.doctype"
		:docname="props.docname"
		v-model:reloadTopics="topics"
		@created="openCreatedTopic"
	/>
</template>
<script setup>
import { createResource, Button } from 'frappe-ui'
import UserAvatar from '@/components/UserAvatar.vue'
import { singularize, timeAgo } from '@/utils'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { computed, ref, watch, onMounted, inject, onUnmounted } from 'vue'
import DiscussionReplies from '@/components/DiscussionReplies.vue'
import DiscussionModal from '@/components/Modals/DiscussionModal.vue'
import { getScrollContainer } from '@/utils/scrollContainer'

const showTopics = ref(true)
const currentTopic = ref(null)
const socket = inject('$socket')
const user = inject('$user')
const showTopicModal = ref(false)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	title: {
		type: String,
		required: true,
	},
	doctype: {
		type: String,
		required: true,
	},
	docname: {
		type: String,
		required: true,
	},
	emptyStateTitle: {
		type: String,
		default: '',
	},
	emptyStateText: {
		type: String,
		default: 'Start a Discussion',
	},
	singleThread: {
		type: Boolean,
		default: false,
	},
	scrollToBottom: {
		type: Boolean,
		default: false,
	},
})

onMounted(() => {
	if (user.data) topics.reload()

	socket.on('new_discussion_topic', (data) => {
		topics.refresh()
	})

	if (props.scrollToBottom) {
		setTimeout(() => {
			scrollToEnd()
		}, 100)
	}
})

const scrollToEnd = () => {
	let scrollContainer = getScrollContainer()
	scrollContainer.scrollTop = scrollContainer.scrollHeight
}

const topics = createResource({
	url: 'lms.lms.utils.get_discussion_topics',
	cache: ['topics', props.doctype, props.docname],
	makeParams() {
		return {
			doctype: props.doctype,
			docname: props.docname,
			single_thread: props.singleThread,
		}
	},
})

// An empty or failed list gets the whole area; the heading and its New button
// would only repeat what the empty state already says and offers.
const showsEmptyState = computed(
	() =>
		(props.singleThread && Boolean(topics.error)) ||
		(!props.singleThread && Array.isArray(topics.data) && !topics.data.length)
)

const showReplies = (topic) => {
	showTopics.value = false
	currentTopic.value = topic
}

// On wide screens the thread sits beside the list, so open the newest question
// instead of leaving that side empty. Phones show the list or a thread, not
// both, so they keep the list.
watch(
	() => topics.data,
	(data) => {
		if (props.singleThread || currentTopic.value || !data?.length) return
		if (window.matchMedia?.('(min-width: 768px)').matches) {
			showReplies(data[0])
		}
	},
	{ immediate: true }
)

// DiscussionReplies' back button (shown only on mobile) sets showTopics = true;
// treat that as "deselect" so the master list returns on small screens.
watch(showTopics, (visible) => {
	if (visible) currentTopic.value = null
})

const openTopicModal = () => {
	showTopicModal.value = true
}

// After a new question is posted, jump straight into its thread instead of
// leaving the user on the list.
const openCreatedTopic = (topicName) => {
	const topic = topics.data?.find((t) => t.name === topicName)
	if (topic) showReplies(topic)
}

onUnmounted(() => {
	socket.off('new_discussion_topic')
})
</script>
