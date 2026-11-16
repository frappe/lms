import type {
	CourseFeedbackSummary,
	FeedbackModalConfig,
	FeedbackSummary,
	RatingKey,
} from '@/types'

export const RATING_KEYS: RatingKey[] = ['content', 'instructors', 'value']

export function ratingLabel(key: RatingKey): string {
	return {
		content: __('Content'),
		instructors: __('Instructors'),
		value: __('Value'),
	}[key]
}

export function batchFeedbackConfig(
	batch: string,
	summary: FeedbackSummary
): FeedbackModalConfig {
	return {
		title: __('Training feedback'),
		url: 'lms.lms.dashboard.batch.get_batch_feedback_list',
		params: { batch },
		cards: RATING_KEYS.map((key) => ({
			title: ratingLabel(key),
			value: summary.averages[key] || null,
			isAverage: true,
		})),
		scores: RATING_KEYS.map((key) => ({ key, label: ratingLabel(key) })),
		filename: `${batch}-feedback.csv`,
		labels: {
			filter: __('Filter responses'),
			empty: __('No feedback received yet.'),
			list: __('Responses'),
			item: __('Response'),
			previous: __('Previous response'),
			next: __('Next response'),
			select: __('Select a response to read it in full.'),
		},
	}
}

export function courseFeedbackConfig(
	course: string,
	summary: CourseFeedbackSummary
): FeedbackModalConfig {
	return {
		title: __('Rating'),
		url: 'lms.lms.dashboard.course.get_course_review_list',
		params: { course },
		average: summary.average,
		cards: [],
		scores: [{ key: 'rating', label: __('Rating') }],
		filename: `${course}-reviews.csv`,
		labels: {
			filter: __('Filter reviews'),
			empty: __('No reviews yet.'),
			list: __('Reviews'),
			item: __('Review'),
			previous: __('Previous review'),
			next: __('Next review'),
			select: __('Select a review to read it in full.'),
		},
	}
}
