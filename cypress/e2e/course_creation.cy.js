describe("Course Creation", () => {
	beforeEach(() => {
		cy.login();
		cy.visit("/courses");
	});

	it("creates a new course", () => {
		cy.get("button").contains("Create a Course").click();
		cy.get("button").contains("Add Tag").click();
		cy.get(".course-card-pills").type("Test");
		cy.get("#title").type("Test Course");
		cy.get("#intro").type("Test Course Short Introduction");
	});
});
