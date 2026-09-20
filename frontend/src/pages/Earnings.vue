<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<PageBody :title="__('Earnings and payouts')">
		<div class="space-y-6 p-5" v-if="dashboard.data">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div v-for="card in statCards" :key="card.key" class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
					<p class="text-sm text-ink-gray-5">{{ card.label }}</p>
					<p class="mt-1 text-2xl font-semibold text-ink-gray-9">{{ money(dashboard.data.stats[card.key]) }}</p>
				</div>
			</div>

			<div v-if="!dashboard.data.is_manager" class="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<section class="rounded-lg border border-outline-gray-2 p-5">
					<h2 class="text-lg font-semibold">{{ __('Payment details') }}</h2>
					<p class="mt-1 text-sm text-ink-gray-5">{{ __('Your details are reviewed again whenever they change.') }}</p>
					<div class="mt-4 space-y-3">
						<FormControl v-model="profile.account_name" :label="__('Account holder name')" />
						<FormControl v-model="profile.iin_bin" :label="__('IIN / BIN')" />
						<FormControl v-model="profile.iban" :label="__('IBAN')" placeholder="KZ…" />
						<Button variant="solid" :loading="savingProfile" @click="saveProfile">{{ __('Save payment details') }}</Button>
					</div>
				</section>
				<section class="rounded-lg border border-outline-gray-2 p-5">
					<h2 class="text-lg font-semibold">{{ __('Payout rules') }}</h2>
					<p class="mt-3 text-sm text-ink-gray-6">{{ __('Platform commission') }}: {{ dashboard.data.commission_percent }}%</p>
					<p class="mt-2 text-sm text-ink-gray-6">{{ __('Funds become available after {0} days.', [dashboard.data.hold_days]) }}</p>
					<Button class="mt-5" variant="solid" :disabled="!dashboard.data.stats.available" :loading="requestingPayout" @click="requestPayout">{{ __('Request payout') }}</Button>
				</section>
			</div>

			<section class="overflow-hidden rounded-lg border border-outline-gray-2">
				<div class="border-b border-outline-gray-2 p-4"><h2 class="font-semibold">{{ __('Sales') }}</h2></div>
				<div class="overflow-x-auto">
					<table class="w-full min-w-[760px] text-sm">
						<thead class="bg-surface-gray-1 text-start text-ink-gray-5"><tr><th class="p-3 text-start">{{ __('Course') }}</th><th v-if="dashboard.data.is_manager" class="p-3 text-start">{{ __('Instructor') }}</th><th class="p-3 text-start">{{ __('Date') }}</th><th class="p-3 text-start">{{ __('Status') }}</th><th class="p-3 text-end">{{ __('Gross') }}</th><th class="p-3 text-end">{{ __('Platform') }}</th><th class="p-3 text-end">{{ __('Instructor') }}</th></tr></thead>
						<tbody><tr v-for="row in dashboard.data.earnings" :key="row.name" class="border-t border-outline-gray-1"><td class="p-3">{{ row.course }}</td><td v-if="dashboard.data.is_manager" class="p-3">{{ row.instructor }}</td><td class="p-3">{{ formatDate(row.creation) }}</td><td class="p-3"><span class="rounded-full bg-surface-gray-2 px-2 py-1 text-xs">{{ row.status }}</span></td><td class="p-3 text-end">{{ money(row.gross_amount, row.currency) }}</td><td class="p-3 text-end">{{ money(row.platform_commission, row.currency) }}</td><td class="p-3 text-end font-medium">{{ money(row.instructor_amount, row.currency) }}</td></tr><tr v-if="!dashboard.data.earnings.length"><td class="p-6 text-center text-ink-gray-5" :colspan="dashboard.data.is_manager ? 7 : 6">{{ __('No paid course sales yet.') }}</td></tr></tbody>
					</table>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-outline-gray-2">
				<div class="border-b border-outline-gray-2 p-4"><h2 class="font-semibold">{{ __('Payout requests') }}</h2></div>
				<div class="divide-y divide-outline-gray-1">
					<div v-for="payout in dashboard.data.payouts" :key="payout.name" class="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
						<div><p class="font-medium">{{ payout.name }} · {{ money(payout.amount, payout.currency) }}</p><p class="text-sm text-ink-gray-5">{{ payout.instructor }} · {{ payout.status }}</p></div>
						<div v-if="dashboard.data.is_manager && payout.status === 'Requested'" class="flex gap-2"><FormControl v-model="references[payout.name]" :placeholder="__('Bank reference')" /><Button variant="solid" @click="markPaid(payout.name)">{{ __('Mark paid') }}</Button></div>
					</div>
					<p v-if="!dashboard.data.payouts.length" class="p-6 text-center text-sm text-ink-gray-5">{{ __('No payout requests yet.') }}</p>
				</div>
			</section>
		</div>
	</PageBody>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Button, call, createResource, FormControl, toast } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import PageBody from '@/components/Layouts/PageBody.vue'

const breadcrumbs = [{ label: __('Earnings and payouts'), route: { name: 'Earnings' } }]
const profile = reactive({ account_name: '', iin_bin: '', iban: '' })
const references = reactive({})
const savingProfile = ref(false)
const requestingPayout = ref(false)
const dashboard = createResource({ url: 'lms.lms.earnings.get_earnings_dashboard', auto: true })
watch(() => dashboard.data?.profile, (value) => Object.assign(profile, value || {}), { immediate: true })
const statCards = computed(() => [
	{ key: 'pending', label: __('Pending') }, { key: 'available', label: __('Available') },
	{ key: 'requested', label: __('Requested') }, { key: 'paid', label: __('Paid') },
])
const money = (value, currency = 'KZT') => new Intl.NumberFormat('ru-KZ', { style: 'currency', currency }).format(value || 0)
const formatDate = (value) => new Intl.DateTimeFormat('ru-KZ', { dateStyle: 'medium' }).format(new Date(value))
const saveProfile = async () => { savingProfile.value = true; try { await call('lms.lms.earnings.save_payment_profile', profile); toast.success(__('Payment details saved')); await dashboard.reload() } catch (e) { toast.error(e?.messages?.[0] || e?.message || __('Could not save payment details')) } finally { savingProfile.value = false } }
const requestPayout = async () => { requestingPayout.value = true; try { await call('lms.lms.earnings.request_payout'); toast.success(__('Payout requested')); await dashboard.reload() } catch (e) { toast.error(e?.messages?.[0] || e?.message || __('Could not request payout')) } finally { requestingPayout.value = false } }
const markPaid = async (payout) => { try { await call('lms.lms.earnings.mark_payout_paid', { payout, bank_reference: references[payout] || '' }); toast.success(__('Payout marked as paid')); await dashboard.reload() } catch (e) { toast.error(e?.messages?.[0] || e?.message || __('Could not update payout')) } }
</script>
