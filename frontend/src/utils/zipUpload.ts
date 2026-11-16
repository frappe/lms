// upload_file refuses a ZIP from anyone without desk access, which is every LMS
// role, so course archives and SCORM packages upload through LMS's own method.
export const ZIP_UPLOAD_ENDPOINT = '/api/method/lms.lms.api.upload_zip'
