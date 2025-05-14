<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div>
				<div class="text-xl font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<!-- <div class="text-xs text-ink-gray-5">
					{{ __(description) }}
				</div> -->
			</div>
			<div class="flex item-center space-x-2">
				<FormControl
					v-model="search"
					:placeholder="__('Search')"
					type="text"
					:debounce="300"
				/>
				<Button @click="() => (showForm = !showForm)">
					<template #prefix>
						<Plus v-if="!showForm" class="size-4 stroke-1.5" />
						<X v-else class="size-4 stroke-1.5" />
					</template>
					{{ showForm ? __('Close') : __('New') }}
				</Button>
			</div>
		</div>

		<!-- Form to add new member -->
		<div v-if="showForm" class="flex items-center space-x-2 my-4">
			<FormControl
				v-model="email"
				:placeholder="__('Email')"
				type="email"
				class="w-full"
			/>
			<Button @click="addEvaluator()" variant="subtle">
				{{ __('Add') }}
			</Button>
		</div>

		<div class="divide-y">
			<div
				v-for="evaluator in evaluators.data"
				@click="openProfile(evaluator.username)"
				class="cursor-pointer"
			>
				<div class="flex items-center justify-between py-3">
					<div class="flex items-center space-x-3">
						<Avatar
							:image="evaluator.user_image"
							:label="evaluator.full_name"
							size="lg"
						/>
						<div>
							<div class="text-base font-semibold text-ink-gray-9">
								{{ evaluator.full_name }}
							</div>
							<div class="text-xs text-ink-gray-5">
								{{ evaluator.evaluator }}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { createResource, Button, FormControl, call, Avatar } from 'frappe-ui'
import { ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
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
	show: {
		type: Boolean,
	},
})

const evaluators = createResource({
	url: 'frappe.client.get_list',
	makeParams: () => {
		return {
			doctype: 'Course Evaluator',
			fields: ['evaluator', 'full_name', 'user_image', 'username'],
			filters: search.value ? { evaluator: ['like', `%${search.value}%`] } : {},
		}
	},
	auto: true,
})

const addEvaluator = () => {
	call('lms.lms.api.add_an_evaluator', {
		email: email.value,
	}).then((data) => {
		showForm.value = false
		email.value = ''
		evaluators.reload()
	})
}

watch(search, () => {
	evaluators.reload()
})

const openProfile = (username) => {
	show.value = false
	router.push({
		name: 'Profile',
		params: {
			username: username,
		},
	})
}
</script>
