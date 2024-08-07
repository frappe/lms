import posthog from "posthog-js";
import { createResource } from 'frappe-ui'

const apiInfo = createResource({
    url: 'lms.lms.api.get_posthog_api_key',
    cache: 'apiInfo',
    auto: true,
    onSuccess(data) {
        return data
    },
})


export default {
    install(app) {
        app.config.globalProperties.$posthog = posthog.init(apiInfo.data.project_id, {
            api_host: apiInfo.data.posthog_host,
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            advanced_disable_decide: apiInfo.data.should_record_session,
        });
    },
};
