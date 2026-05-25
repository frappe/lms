<template>
	<section class="space-y-5 border-t pt-6">
		<div class="text-base font-semibold text-ink-gray-9">
			{{ __('Course overview') }}
		</div>
		<FormControl
			v-model="doc.video_link"
			:label="__('Embed (preview video)')"
			:description="__('Supports YouTube and Vimeo.')"
			:placeholder="__('e.g. https://www.youtube.com/video')"
			variant="outline"
			@input="markDirty()"
		/>
		<div class="space-y-1.5">
			<label
				:for="descriptionId"
				class="block text-p-sm font-medium text-ink-gray-7"
			>
				{{ __('Course Description') }}
				<span class="text-ink-red-3">*</span>
			</label>
			<div
				class="rounded-t-lg rounded-b-md outline-none transition-[box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:ring-2 ring-outline-gray-3"
			>
				<TextEditor
					:id="descriptionId"
					:content="doc.description"
					@change="
						(val) => {
							doc.description = val
							markDirty()
						}
					"
					:editable="true"
					:fixedMenu="true"
					editorClass="prose-sm max-w-none border-b border-x border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md py-1 px-2 min-h-[7rem] transition-colors"
				/>
			</div>
		</div>
		<MultiLink
			v-model="relatedCourses"
			doctype="LMS Course"
			:filters="{ name: ['!=', resource.doc?.name] }"
			:label="__('Related Courses')"
			:placeholder="__('Select related courses')"
			variant="outline"
			:onCreate="goToCreateCourse"
			@update:modelValue="markDirty()"
		/>
	</section>

	<section class="space-y-5 border-t pt-6">
		<div>
			<div class="text-base font-semibold text-ink-gray-9">
				{{ __('Meta Tags') }}
			</div>
			<div class="mt-1 text-p-sm text-ink-gray-6">
				{{
					__(
						'These tags help search engines describe and rank your course in results.'
					)
				}}
			</div>
		</div>
		<FormControl
			v-model="meta.description"
			:label="__('Meta description')"
			type="textarea"
			:rows="4"
			:placeholder="__('A short summary of the course for search results.')"
			variant="outline"
			@input="markDirty()"
		/>
		<FormControl
			v-model="meta.keywords"
			:label="__('Meta keywords')"
			type="textarea"
			:rows="4"
			:placeholder="__('Comma separated keywords for SEO')"
			variant="outline"
			@input="markDirty()"
		/>
	</section>
</template>

<script setup lang="ts">
import { TextEditor, FormControl } from 'frappe-ui'
import { computed, inject, useId } from 'vue'
import { useRouter } from 'vue-router'
import MultiLink from '@/components/Controls/MultiLink.vue'
import type { CourseFormContext } from '@/types/api'

const { resource, relatedCourses, meta, markDirty } =
	inject<CourseFormContext>('courseForm')!
const router = useRouter()
const doc = computed(() => resource.doc)
const descriptionId = useId()

function goToCreateCourse(close: () => void) {
	close()
	router.push({ name: 'Courses', query: { newCourse: '1' } })
}
</script>
