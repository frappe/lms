<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="flex items-center justify-between">
			<div>
				<div class="text-xl font-semibold mb-2 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<div class="text-ink-gray-6 leading-5">
					{{ __(description) }}
				</div>
			</div>
			<div class="flex item-center space-x-2">
				<Dropdown
					placement="right"
					side="bottom"
					:options="[
						{
							label: __('New Evaluator'),
							icon: 'user-plus',
							onClick() {
								showNewEvaluator = true
							},
						},
						{
							label: __('Existing User'),
							icon: 'user-check',
							onClick() {
								showExistingUser = true
							},
						},
					]"
				>
					<template v-slot="{ open }">
						<Button variant="solid">
							<template #prefix>
								<Plus class="size-4 stroke-1.5" />
							</template>
							{{ __('New') }}
							<template #suffix>
								<ChevronDown
									:class="[
										'w-4 h-4 stroke-1.5 ml-1 transform transition-transform',
										open ? 'rotate-180' : '',
									]"
								/>
							</template>
						</Button>
					</template>
				</Dropdown>
			</div>
		</div>

		<div class="mt-8 pb-5">
			<FormControl
				v-if="evaluators.data?.length > 0 || search"
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
			<div class="overflow-auto max-h-[60vh]">
				<div class="divide-y divide-outline-gray-modals">
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
				<div v-if="evaluators.hasNextPage" class="flex justify-center mt-4">
					<Button @click="evaluators.next()">
						<template #prefix>
							<RefreshCw class="h-3 w-3 stroke-1.5" />
						</template>
						{{ __('Load More') }}
					</Button>
				</div>
			</div>
		</div>
	</div>
	<AddEvaluatorModal v-model="showExistingUser" @added="evaluators.reload()" />
	<NewMemberModal
		v-model="showNewEvaluator"
		:defaultRoles="['batch_evaluator']"
		@created="onMemberCreated"
	/>
</template>
<script setup lang="ts">
import {
	Avatar,
	Button,
	call,
	createListResource,
	Dropdown,
	FormControl,
	toast,
} from 'frappe-ui'
import { ref, watch } from 'vue'
import { Plus, Search, Trash2, RefreshCw, ChevronDown } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'
import AddEvaluatorModal from '@/components/Modals/AddEvaluatorModal.vue'

const search = ref('')
const showExistingUser = ref(false)
const showNewEvaluator = ref(false)
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

const onMemberCreated = () => {
	evaluators.reload()
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
	router.push({
		name: 'Profile',
		params: {
			username: username,
		},
	})
}

const deleteEvaluator = (evaluator: string) => {
	call('frappe.client.delete', {
		doctype: 'Course Evaluator',
		name: evaluator,
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
