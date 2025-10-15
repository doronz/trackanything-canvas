# Pull Request

## PR Naming Convention

Please name your PR using conventional commit prefixes for better organization:

```
feat: Add new feature or widget
fix: Bug fix or issue resolution
docs: Documentation updates
refactor: Code refactoring (no functional changes)
test: Test additions or updates
chore: Maintenance, dependencies, or configuration
style: Code formatting or UI updates
perf: Performance improvements
ci: CI/CD configuration changes
```

**Examples:**
- `feat: add weather widget with forecast display`
- `fix: resolve canvas zoom calculation for negative coordinates`
- `docs: update installation instructions for Windows users`

## Description

<!-- Provide a clear and concise description of your changes -->

## Type of Change

<!-- Mark relevant items with an [x] -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Style/UI update (no functional changes)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Configuration change
- [ ] 🔒 Security update

## Related Issues

<!-- Link to related issues using keywords: Fixes #123, Closes #456, Related to #789 -->

Fixes #
Related to #

## Changes Made

<!-- List the specific changes made in this PR -->

-
-
-

## Screenshots (if applicable)

<!-- Add screenshots or screen recordings for UI changes -->

| Before | After |
|--------|-------|
| ![Before](url) | ![After](url) |

## Testing

### Test Environment

- OS:
- Browser (if applicable):
- Deployment Method: [ ] Docker [ ] Manual

### How Has This Been Tested?

<!-- Describe the tests you ran to verify your changes -->

- [ ] Manual testing in development environment
- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Tested with Docker
- [ ] Tested with manual setup

### Test Coverage

<!-- If you added tests, what do they cover? -->

- [ ] New tests added for new features/fixes
- [ ] Existing tests updated
- [ ] All tests pass locally
- [ ] No tests needed (explain why):

## Code Quality Checklist

<!-- Ensure your code meets quality standards -->

### Code Standards

- [ ] Code follows the project's style guidelines
- [ ] Self-reviewed my own code
- [ ] Commented complex or non-obvious code
- [ ] No unnecessary console.log or debug statements
- [ ] Removed commented-out code

### Backend (if applicable)

- [ ] Follows PEP 8 style guide
- [ ] Type hints added for functions
- [ ] Docstrings added for public methods
- [ ] Code formatted with Black
- [ ] Linting passes (flake8/pylint)
- [ ] Database migrations created (if schema changed)

### Frontend (if applicable)

- [ ] Follows TypeScript/React best practices
- [ ] TypeScript types defined properly
- [ ] ESLint passes without errors
- [ ] No TypeScript `any` types (or justified)
- [ ] Components are properly typed
- [ ] Responsive design tested

## Documentation

<!-- Ensure documentation is up to date -->

- [ ] README.md updated (if needed)
- [ ] CONTRIBUTING.md updated (if needed)
- [ ] API documentation updated (if applicable)
- [ ] Code comments added/updated
- [ ] CHANGELOG.md will be updated by maintainers

## Performance Impact

<!-- Describe any performance impact -->

- [ ] No significant performance impact
- [ ] Performance improved
- [ ] Performance decreased (please explain why it's acceptable)

**Performance Notes:**


## Security Considerations

<!-- Address any security implications -->

- [ ] No security implications
- [ ] Security implications addressed
- [ ] Credentials/secrets properly handled
- [ ] Input validation implemented
- [ ] XSS/injection vulnerabilities considered

**Security Notes:**


## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**Impact:**


**Migration Path:**


## Deployment Notes

<!-- Any special deployment considerations? -->

- [ ] No special deployment steps needed
- [ ] Environment variables added/changed (documented)
- [ ] Database migration required
- [ ] Dependencies added/updated
- [ ] Configuration changes needed

**Deployment Instructions:**


## Checklist

<!-- Final checklist before submitting -->

- [ ] My code follows the project's contribution guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I have checked my code and corrected any misspellings
- [ ] I have tested this in Docker (if applicable)
- [ ] I have updated the relevant documentation

## Additional Notes

<!-- Any additional information that reviewers should know -->



## For Reviewers

<!-- This section is for maintainers -->

**Review Checklist:**

- [ ] Code quality is acceptable
- [ ] Tests are comprehensive
- [ ] Documentation is adequate
- [ ] No security concerns
- [ ] Performance is acceptable
- [ ] Breaking changes are justified and documented
- [ ] Ready to merge

---

Thank you for contributing to Canvas MCP Client! 🎉

