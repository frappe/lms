describe("Quiz", () => {
	let questionName, quizName, proctoredQuizName;

	before(() => {
		cy.login();

		// Create the LMS Question that both quizzes will share
		cy.request({
			url: "/api/method/frappe.client.insert",
			method: "POST",
			body: {
				doc: {
					doctype: "LMS Question",
					question: "What is 2 + 2?",
					type: "Choices",
					option_1: "3",
					option_2: "4",
					option_3: "5",
					option_4: "6",
					is_correct_2: 1,
				},
			},
		}).then(({ body }) => {
			questionName = body.message.name;

			// Plain multiple-choice quiz
			cy.request({
				url: "/api/method/frappe.client.insert",
				method: "POST",
				body: {
					doc: {
						doctype: "LMS Quiz",
						title: "Cypress Test Quiz",
						passing_percentage: 60,
						questions: [
							{
								doctype: "LMS Quiz Question",
								question: questionName,
								marks: 5,
							},
						],
					},
				},
			}).then(({ body }) => {
				quizName = body.message.name;
			});

			// Proctored quiz
			cy.request({
				url: "/api/method/frappe.client.insert",
				method: "POST",
				body: {
					doc: {
						doctype: "LMS Quiz",
						title: "Cypress Proctored Quiz",
						passing_percentage: 60,
						enable_proctoring: 1,
						max_violations: 3,
						questions: [
							{
								doctype: "LMS Quiz Question",
								question: questionName,
								marks: 5,
							},
						],
					},
				},
			}).then(({ body }) => {
				proctoredQuizName = body.message.name;
			});
		});
	});

	after(() => {
		cy.login();
		cy.request({
			url: "/api/method/frappe.client.delete",
			method: "POST",
			body: { doctype: "LMS Quiz", name: quizName },
			failOnStatusCode: false,
		});
		cy.request({
			url: "/api/method/frappe.client.delete",
			method: "POST",
			body: { doctype: "LMS Quiz", name: proctoredQuizName },
			failOnStatusCode: false,
		});
		cy.request({
			url: "/api/method/frappe.client.delete",
			method: "POST",
			body: { doctype: "LMS Question", name: questionName },
			failOnStatusCode: false,
		});
	});

	context("multiple choice quiz", () => {
		it("shows quiz info on the start screen", () => {
			cy.login();
			cy.visit(`/lms/quiz/${quizName}`);
			cy.closeOnboardingModal();

			cy.contains("Cypress Test Quiz").should("be.visible");
			cy.contains("1 question").should("be.visible");
			cy.contains("Passing score: 60%").should("be.visible");
		});

		it("starts the quiz and shows the question with answer choices", () => {
			cy.login();
			cy.visit(`/lms/quiz/${quizName}`);
			cy.closeOnboardingModal();

			cy.button("Start Quiz").should("not.be.disabled").click();

			cy.contains("What is 2 + 2?", { timeout: 10000 }).should(
				"be.visible"
			);
			cy.get('input[type="radio"]').should("have.length.greaterThan", 0);
		});

		it("submits the quiz and shows the result", () => {
			cy.login();
			cy.visit(`/lms/quiz/${quizName}`);
			cy.closeOnboardingModal();

			cy.button("Start Quiz").click();

			// Select any answer
			cy.get('input[type="radio"]', { timeout: 10000 })
				.first()
				.check({ force: true });

			cy.intercept(
				"POST",
				"**/api/method/lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz"
			).as("submitQuiz");

			// show_answers defaults to 1 on LMS Quiz, so a choice question offers
			// Check before it offers Submit. Submit only replaces it once the
			// answer has been revealed.
			cy.button("Check").click();
			cy.button("Submit").click();
			cy.wait("@submitQuiz", { timeout: 15000 });

			// Result panel appears after submission
			cy.contains(/score|correct|result/i, { timeout: 10000 }).should(
				"exist"
			);
		});
	});

	context("proctored quiz", () => {
		it("shows Proctored badge and camera setup section on the start screen", () => {
			cy.login();
			cy.visit(`/lms/quiz/${proctoredQuizName}`);
			cy.closeOnboardingModal();

			cy.contains("Proctored").should("be.visible");
			cy.contains("Camera Setup").should("be.visible");
			cy.contains("Proctoring Rules").should("be.visible");
		});

		it("keeps Start Quiz disabled while camera access is not granted", () => {
			cy.login();
			cy.visit(`/lms/quiz/${proctoredQuizName}`);
			cy.closeOnboardingModal();

			cy.button("Start Quiz").should("be.disabled");
		});

		it("shows the max-violations auto-submit rule in the rules panel", () => {
			cy.login();
			cy.visit(`/lms/quiz/${proctoredQuizName}`);
			cy.closeOnboardingModal();

			// The rules card runs past the fold on a 660px viewport, so the row has to
			// be brought into view before it can be seen.
			cy.contains("After 3 violations")
				.scrollIntoView()
				.should("be.visible");
		});

		it("starts face detection once camera access is granted", () => {
			cy.login();
			cy.visit(`/lms/quiz/${proctoredQuizName}`, {
				onBeforeLoad(win) {
					// A real MediaStream, not a stand-in object: the monitor assigns what
					// getUserMedia returns straight to video.srcObject, and that setter
					// rejects anything that is not a MediaStream — which threw before the
					// component could leave its loading state. A canvas gives a genuine
					// stream, and it paints, so the video element actually reaches
					// readyState 2 and face detection runs against blank frames.
					const canvas = win.document.createElement("canvas");
					canvas.width = 640;
					canvas.height = 480;
					const ctx = canvas.getContext("2d");
					ctx.fillStyle = "#888888";
					ctx.fillRect(0, 0, canvas.width, canvas.height);
					const stream = canvas.captureStream(30);

					// navigator.mediaDevices exists only in a secure context, and the app
					// is served over plain http here, so the whole object is defined
					// rather than stubbed: cy.stub() replaces an existing property, and on
					// http there is no getUserMedia to replace. Defining an own property
					// also shadows the prototype getter where it does exist.
					Object.defineProperty(win.navigator, "mediaDevices", {
						value: { getUserMedia: () => Promise.resolve(stream) },
						configurable: true,
						writable: true,
					});
				},
			});
			cy.closeOnboardingModal();

			// Accepting the stream moves the monitor off "Loading camera" and into
			// detection, which is as far as CI can go: Start Quiz unlocks on a face,
			// and a painted canvas has none. Either detection label counts — which one
			// shows depends on whether the 800ms detection pass has run yet.
			cy.contains(/Position your face in the frame|No face detected/, {
				timeout: 20000,
			}).should("exist");
			cy.button("Start Quiz").should("be.disabled");
		});
	});
});
