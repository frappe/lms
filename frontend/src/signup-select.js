import { createApp, h, ref } from 'vue'
import { Select } from 'frappe-ui'
import './signup-select.css'

const nativeSelect = document.querySelector('#user_category')
const mountPoint = document.querySelector('#signup_user_category_select')

if (nativeSelect && mountPoint) {
	const formGroup = nativeSelect.closest('.form-group')
	const errorElement = formGroup.querySelector('#user_category_error')
	const options = Array.from(nativeSelect.options)
		.filter((option) => option.value)
		.map((option) => ({
			label: option.textContent.trim(),
			value: option.value,
		}))
	const placeholder = nativeSelect.options[0]?.textContent.trim()
	const label = mountPoint.dataset.label
	const selectedValue = ref(nativeSelect.value || null)
	const errorMessage = ref(errorElement.textContent.trim())

	nativeSelect.addEventListener('change', () => {
		selectedValue.value = nativeSelect.value || null
	})

	const errorObserver = new MutationObserver(() => {
		errorMessage.value = errorElement.textContent.trim()
	})
	errorObserver.observe(errorElement, {
		childList: true,
		characterData: true,
		subtree: true,
	})

	createApp({
		render() {
			return h(
				Select,
				{
					class: 'w-full',
					modelValue: selectedValue.value,
					options,
					variant: 'outline',
					size: 'sm',
					placeholder,
					required: true,
					error: errorMessage.value || undefined,
					'onUpdate:modelValue': (value) => {
						selectedValue.value = value
						nativeSelect.value = value ?? ''
						nativeSelect.dispatchEvent(
							new Event('change', { bubbles: true })
						)
					},
				},
				{
					label: () =>
						h(
							'span',
							{ class: 'text-base text-ink-gray-6 w-full mb-0' },
							label
						),
				}
			)
		},
	}).mount(mountPoint)
}
