(function (config) {
	// Inlined into every HTML file of a SCORM package. The package runs in a sandbox
	// with an opaque origin, so it cannot reach the API on the player page; this
	// gives it one in its own window and posts what it sets to the player.
	var values = config.values || {};
	var post = function (key, value) {
		try {
			window.top.postMessage(
				{ source: "lms-scorm", key: String(key), value: String(value) },
				config.origin
			);
		} catch (e) {
			// The player page is gone; the package carries on without saving.
		}
	};
	var get = function (key) {
		return Object.prototype.hasOwnProperty.call(values, key)
			? values[key]
			: "";
	};
	var set = function (key, value) {
		values[key] = String(value);
		post(key, value);
		return "true";
	};
	var ok = function () {
		return "true";
	};
	var none = function () {
		return "";
	};
	var noError = function () {
		return "0";
	};
	window.API = {
		LMSInitialize: ok,
		LMSFinish: ok,
		LMSGetValue: get,
		LMSSetValue: set,
		LMSCommit: ok,
		LMSGetLastError: noError,
		LMSGetErrorString: none,
		LMSGetDiagnostic: none,
	};
	window.API_1484_11 = {
		Initialize: ok,
		Terminate: ok,
		GetValue: get,
		SetValue: set,
		Commit: ok,
		GetLastError: noError,
		GetErrorString: none,
		GetDiagnostic: none,
	};
});
