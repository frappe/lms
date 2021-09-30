// Copyright (c) 2021, FOSS United and contributors
// For license information, please see license.txt

frappe.ui.form.on('Course Lesson', {
	setup: function (frm) {
	  frm.trigger('setup_help');
	},
	setup_help(frm) {
	  frm.get_field('help').html(`
  <p>You can add some more additional content to the lesson using a special syntax. The table below mentions all types of dynamic content that you can add to the lessons and the syntax for the same.</p>
  <div class="row font-weight-bold mb-3">
	  <div class="col-sm-4">
		  Content Type
	  </div>
	  <div class="col-sm-4">
		  Syntax
	  </div>
  </div>

  <div class="row mb-3">
	  <div class="col-sm-4">
		  Video
	  </div>
	  <div class="col-sm-4">
		  {{ Video("url_of_source") }}
	  </div>
  </div>

  <div class="row mb-3">
	  <div class="col-sm-4">
		  YouTube Video
	  </div>
	  <div class="col-sm-4">
		  {{ YouTubeVideo("unique_embed_id") }}
	  </div>
  </div>

  <div class="row mb-3">
	  <div class="col-sm-4">
		  Exercise
	  </div>
	  <div class="col-sm-4">
		  {{ Exercise("exercise_name") }}
	  </div>
  </div>

  <div class="row mb-3">
	  <div class="col-sm-4">
		  Quiz
	  </div>
	  <div class="col-sm-4">
		  {{ Quiz("lms_quiz_name") }}
	  </div>
  </div>
  `);
	}
  });
