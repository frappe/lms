<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="flex items-center justify-between">
			<div>
				<div class="text-xl font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<div class="text-ink-gray-6 leading-5">
					{{ __(description) }}
				</div>
			</div>
			<div class="flex item-center space-x-2">
				<Button variant="solid" @click="() => (showForm = !showForm)">
					<template #prefix>
						<Plus class="size-4 stroke-1.5" />
					</template>
					{{ __('New') }}
				</Button>
			</div>
		</div>

		<div class="mt-8 pb-5">
			<FormControl
				v-model="search"
				:placeholder="__('Search')"
				type="text"
				:debounce="300"
				class="w-1/4 mb-4"
			>
				<template #prefix>
					<Search class="size-4 stroke-1.5 text-ink-gray-5" />
				</template>
			</FormControl>
			<div class="overflow-auto h-[60vh]">
				<div class="divide-y">
					<div
						v-for="evaluator in evaluators.data"
						:key="evaluator.evaluator"
						class="cursor-pointer"
					>
						<div class="flex items-center justify-between group py-3">
							<div
								class="flex items-center space-x-3"
								@click="openProfile(evaluator.username)"
							>
								<Avatar
									:image="evaluator.user_image"
									:label="evaluator.full_name"
									size="xl"
								/>
								<div class="space-y-1">
									<div class="text-base font-semibold text-ink-gray-9">
										{{ evaluator.full_name }}
									</div>
									<div class="text-xs text-ink-gray-5">
										{{ evaluator.evaluator }}
									</div>
								</div>
							</div>
							<div class="invisible group-hover:visible">
								<Button
									variant="ghost"
									@click="deleteEvaluator(evaluator.evaluator)"
								>
									<template #icon>
										<Trash2 class="size-4 stroke-1.5 text-ink-red-3" />
									</template>
								</Button>
							</div>
						</div>
					</div>
				</div>
				<div
					v-if="evaluators.length && hasNextPage"
					class="flex justify-center mt-4"
				>
					<Button @click="evaluators.reload()">
						<template #prefix>
							<RefreshCw class="h-3 w-3 stroke-1.5" />
						</template>
						{{ __('Load More') }}
					</Button>
				</div>
			</div>
		</div>
	</div>
	<Dialog
		v-model="showForm"
		:options="{ 
			size: 'xl',
			title: __('Add Evaluator'),
			actions: [{
				label: __('Add'),
				variant: 'solid',
				onClick({ close }: any) {
					addEvaluator(close)
				},
			}]
	}"
	>
		<template #body-content>
			<div v-if="showForm" class="flex items-center">
				<FormControl
					v-model="email"
					:label="__('Email')"
					placeholder="jane@doe.com"
					type="email"
					class="w-full"
					@keydown.enter="addEvaluator"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	call,
	createListResource,
	Dialog,
	FormControl,
	toast,
} from 'frappe-ui'
import { ref, watch } from 'vue'
import { Plus, Search, Trash2, RefreshCw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const show = defineModel('show')
const search = ref('')
const showForm = ref(false)
const email = ref('')
const router = useRouter()

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: '',
	},
})

const evaluators = createListResource({
	doctype: 'Course Evaluator',
	fields: ['evaluator', 'username', 'full_name', 'user_image'],
	auto: true,
	orderBy: 'creation desc',
})

const addEvaluator = (close: () => void) => {
	call('lms.lms.api.add_an_evaluator', {
		email: email.value,
	})
		.then(() => {
			email.value = ''
			evaluators.reload()
			toast.success(__('Evaluator added successfully'))
			close()
		})
		.catch((error: any) => {
			toast.error(__(error.messages[0] || error.messages))
			console.error('Error adding evaluator:', error)
		})
}

watch(search, () => {
	evaluators.update({
		filters: {
			full_name: ['like', `%${search.value}%`],
		},
	})
	evaluators.reload()
})

const openProfile = (username: string) => {
	show.value = false
	router.push({
		name: 'Profile',
		params: {
			username: username,
		},
	})
}

const deleteEvaluator = (evaluator: string) => {
	call('lms.lms.api.delete_evaluator', {
		evaluator: evaluator,
	})
		.then(() => {
			toast.success(__('Evaluator deleted successfully'))
			evaluators.reload()
		})
		.catch((error: any) => {
			toast.error(__(error.messages[0] || error.messages))
			console.error('Error deleting evaluator:', error)
		})
}
</script>
