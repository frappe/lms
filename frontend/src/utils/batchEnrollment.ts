import dayjs from '@/utils/dayjs'

/** "Enrolment closes on 15 Dec" for a started batch still taking learners, else ''. */
export function enrollmentClosesLabel(closesOn?: string | null): string {
	if (!closesOn) return ''
	return __('Enrolment closes on {0}').format(dayjs(closesOn).format('D MMM'))
}
