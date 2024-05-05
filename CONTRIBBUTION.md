# Contributing to Frappe LMS

Thank you for your interest in contributing to Frappe LMS! Follow these steps to set up your environment and submit your contributions.

## Setting Up Your Development Environment

1. **Prepare the Repository:**
   - Navigate to the `apps/lms` directory within your local installation.
   - Execute `git pull --unshallow` to ensure you have the full git repository.
   - Fork the `frappe/lms` repository on GitHub to your account.

2. **Create a Working Branch:**
   - Check out a new branch for your changes: 
     ```bash
     git checkout -b my-new-feature
     ```

## Making Changes

1. **Develop Your Feature or Fix:**
   - Make your proposed changes in the source code. Ensure you are on your feature branch when doing so.

2. **Test Locally:**
   - Start your local development server to test the changes:
     ```bash
     bench start
     ```
   - Verify that your changes work as expected without introducing new issues.

## Submitting Changes

1. **Commit Your Changes:**
   - Commit your changes using a semantic commit message that describes the nature of your changes:
     ```bash
     git commit -m "feat: add a new grading feature"
     ```

2. **Push to GitHub:**
   - Push your branch to your fork on GitHub:
     ```bash
     git push origin my-new-feature
     ```

3. **Create a Pull Request:**
   - Navigate to the original `frappe/lms` repository on GitHub.
   - Issue a pull request from your fork's branch to the main repository.
   - Clearly describe the purpose of your changes and any testing that was performed.

## Additional Guidelines

- Ensure your code adheres to the project's coding standards.
- Include any necessary tests for new features or fixes.
- Update documentation as needed to reflect your changes.

Your contributions are valued, and we look forward to reviewing them!
