describe("Public pages", () => {
	const pages = [
		["/lms/about", "About the platform"],
		["/lms/help", "Help center"],
		["/lms/contact", "Contact us"],
		["/lms/privacy", "Privacy policy"],
		["/lms/terms", "Terms of use"],
	];

	for (const [path, heading] of pages) {
		it(`opens ${path} without authentication`, () => {
			cy.visit(path);
			cy.contains("h1", heading).should("be.visible");
			cy.get('a[href="/login"]').should("be.visible");
			cy.get("footer").should("be.visible");
		});
	}

	it("keeps the public navigation usable on a phone", () => {
		cy.viewport(375, 667);
		cy.visit("/lms/help");
		cy.contains("h1", "Help center").should("be.visible");
		cy.get("main").should("not.have.css", "overflow-x", "scroll");
		cy.contains("a", "Reset password")
			.should("have.attr", "href", "/login#forgot");
	});

	it("serves the login, sign-up, and password recovery entry points", () => {
		cy.visit("/login");
		cy.get("body").should("be.visible");
		cy.visit("/login#signup");
		cy.get("body").should("contain.text", "Sign Up");
		cy.visit("/login#forgot");
		cy.get("body").should("contain.text", "Forgot Password");
	});
});
