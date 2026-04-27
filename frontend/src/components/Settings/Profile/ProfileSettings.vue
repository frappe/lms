<template>
	<div v-if="userSettings.data" class="flex flex-col h-full text-p-base">
		<div>
			<div class="flex items-center justify-between">
				<div class="space-y-2">
					<div class="font-semibold text-xl text-ink-gray-9">
						{{ __(label) }}
					</div>
					<div class="text-ink-gray-6 leading-5">
						{{ __(description) }}
					</div>
				</div>
				<div class="flex items-center gap-x-2">
					<Badge
						v-if="isDirty"
						:label="__('Not Saved')"
						variant="subtle"
						theme="orange"
					/>
					<Button
						variant="solid"
						:loading="updateSettings.loading"
						@click="save"
					>
						{{ __('Update') }}
					</Button>
				</div>
			</div>
		</div>
		<div class="overflow-y-auto mt-6 flex flex-col gap-5">
			<div class="flex items-center gap-4">
				<FileUploader
					:validateFile="validateIsImageFile"
					@success="(file) => updateImage(file.file_url)"
				>
					<template #default="{ openFileSelector, error: _error, uploading }">
						<div class="group relative !size-16">
							<Avatar
								class="!size-16"
								:image="userSettings.data.user_image"
								:label="fullName"
							/>
							<Tooltip
								:hoverDelay="0"
								placement="bottom"
								:text="profileTooltipText"
							>
								<div
									class="z-1 absolute top-0 left-0 flex cursor-pointer items-center justify-center rounded-full !size-16"
									@click.stop="openFileSelector"
								/>
								<div
									v-if="userSettings.data.user_image"
									class="z-1 size-4 absolute -top-1 -right-1 flex cursor-pointer items-center justify-center rounded-full bg-surface-white opacity-0 duration-300 ease-in-out group-hover:opacity-100 hover:bg-surface-gray-2 outline outline-black-overlay-50"
									@click.stop="updateImage()"
									@mouseenter="isHoveringRemove = true"
									@mouseleave="isHoveringRemove = false"
								>
									<FeatherIcon
										name="x"
										class="size-3.5 cursor-pointer text-ink-gray-4"
									/>
								</div>
							</Tooltip>
							<div
								v-if="uploading"
								class="w-full h-full top-0 left-0 absolute bg-black bg-opacity-20 rounded-full flex items-center justify-center"
							>
								<LoadingIndicator class="size-4" />
							</div>
						</div>
						<ErrorMessage :message="__(_error)" />
					</template>
				</FileUploader>
				<div class="flex flex-col gap-1">
					<span class="text-lg font-semibold text-ink-gray-8">
						{{ fullName || __('Your Name') }}
					</span>
					<span class="text-p-sm text-ink-gray-6">
						{{ userSettings.data.email }}
					</span>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormControl
					:label="__('First Name')"
					v-model="userSettings.data.first_name"
				/>
				<FormControl
					:label="__('Last Name')"
					v-model="userSettings.data.last_name"
				/>
				<FormControl
					:label="__('Username')"
					v-model="userSettings.data.username"
					:placeholder="__('Used for login if enabled')"
				/>
				<FormControl
					:label="__('Phone')"
					v-model="userSettings.data.mobile_no"
					:placeholder="__('e.g. +91 98765 43210')"
				/>
				<Link
					:label="__('Language')"
					v-model="userSettings.data.language"
					doctype="Language"
				/>

				<div class="space-y-1.5">
					<label class="block text-xs text-ink-gray-5">
						{{ __('Timezone') }}
					</label>
					<Combobox
						v-model="userSettings.data.time_zone"
						:options="getTimezoneOptions()"
					/>
				</div>
			</div>

			<Divider class="mt-2" />

			<div class="flex items-center justify-between">
				<div class="flex flex-col gap-1">
					<span class="text-base font-medium text-ink-gray-8">
						{{ __('Password') }}
					</span>
					<span class="text-p-sm text-ink-gray-6">
						{{ __('Change your account password for security.') }}
					</span>
				</div>
				<Button
					:label="__('Change Password')"
					@click="showChangePasswordModal = true"
				/>
			</div>
		</div>
		<ChangePasswordModal
			v-if="showChangePasswordModal"
			v-model="showChangePasswordModal"
		/>
	</div>
</template>

<script setup>
import ChangePasswordModal from '@/components/Modals/ChangePasswordModal.vue'
import Link from '@/components/Controls/Link.vue'
import {
	Avatar,
	Badge,
	Button,
	Combobox,
	Divider,
	ErrorMessage,
	FeatherIcon,
	FileUploader,
	FormControl,
	LoadingIndicator,
	Tooltip,
	createResource,
	toast,
} from 'frappe-ui'
import { ref, computed, watch } from 'vue'

const props = defineProps({
	userSettings: {
		type: Object,
		required: true,
	},
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
	},
})

const userSettings = props.userSettings

const updateSettings = createResource({
	url: 'lms.lms.api.update_user_settings',
})

const isDirty = ref(false)
let initialSnapshot = null

watch(
	() => userSettings.data,
	(newData) => {
		if (!newData) return
		if (initialSnapshot === null) {
			initialSnapshot = JSON.parse(JSON.stringify(newData))
			return
		}
		isDirty.value = true
	},
	{ deep: true, immediate: true }
)

const showChangePasswordModal = ref(false)
const isHoveringRemove = ref(false)

const fullName = computed(() =>
	[userSettings.data?.first_name, userSettings.data?.last_name]
		.filter(Boolean)
		.join(' ')
)

const profileTooltipText = computed(() => {
	if (isHoveringRemove.value) return __('Remove Photo')
	return userSettings.data?.user_image ? __('Change Photo') : __('Upload Photo')
})

function validateIsImageFile(file) {
	const ext = file.name.split('.').pop().toLowerCase()
	const allowed = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp']
	if (!allowed.includes(ext)) return __('Only image files are allowed')
}

const timeZones = createResource({
	url: 'frappe.core.doctype.user.user.get_timezones',
	cache: 'TimeZones',
	auto: true,
})

function getTimezoneOptions() {
	return timeZones.data?.timezones.map((tz) => ({ label: tz, value: tz })) || []
}

function save() {
	const refreshRequired =
		initialSnapshot !== null &&
		(userSettings.data?.language !== initialSnapshot.language ||
			userSettings.data?.time_zone !== initialSnapshot.time_zone ||
			userSettings.data?.username !== initialSnapshot.username)

	const { email: _email, ...payload } = userSettings.data || {}

	updateSettings.submit(payload, {
		onSuccess: () => {
			toast.success(__('Profile updated successfully'))
			if (refreshRequired) {
				window.location.reload()
			} else {
				initialSnapshot = JSON.parse(JSON.stringify(userSettings.data))
				isDirty.value = false
			}
		},
		onError: (err) => {
			toast.error(err.message + ': ' + (err.messages?.[0] || ''))
		},
	})
}

function updateImage(fileUrl = '') {
	isHoveringRemove.value = false
	userSettings.data.user_image = fileUrl
	save()
}
</script>
