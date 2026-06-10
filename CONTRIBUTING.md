# Contributing to ReconGPT

Thank you for your interest in contributing to ReconGPT! This document provides guidelines and rules for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Philosophy

ReconGPT follows a **modular pipeline architecture**. Each component should be:
- **Isolated**: One stage should not directly depend on another's internals
- **Testable**: All functions must be unit-testable
- **Documented**: Clear docstrings and type hints required

## Contribution Rules

### ✅ DO:
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation alongside code changes
- Follow the existing code structure
- Use type hints in all Python code
- Keep functions small and focused (< 50 lines preferred)
- **Vibe coding is ALLOWED** - rapid prototyping is encouraged!

### ❌ DON'T:
- **Modify more than 3-5 files in a single PR** (unless it's a refactor)
- Push directly to `main` - always use PRs
- Add dependencies without discussion in an issue first
- Remove existing functionality without deprecation notice
- Ignore linting/formatting errors
- Commit sensitive data (API keys, credentials, scan results)

## Pull Request Process

### 1. Before You Start
- Open an issue to discuss major changes
- Fork the repository
- Create a feature branch: `git checkout -b feature/your-feature-name`

### 2. During Development
- Keep PRs focused on a single feature/fix
- Limit to **5 files or less per PR** (exceptions require justification)
- Write meaningful commit messages:
  ```
  feat(pipeline): add JavaScript mining stage
  fix(httpx): handle timeout errors gracefully
  docs(api): update scan endpoint examples
  ```

### 3. Before Submitting
- [ ] Code passes all tests: `pytest`
- [ ] Code is formatted: `black backend/ && isort backend/`
- [ ] Type checking passes: `mypy backend/`
- [ ] Documentation updated if needed
- [ ] No secrets or credentials in code
- [ ] `.env.example` updated if new env vars added

### 4. PR Review Process
- **All PRs require 1 maintainer approval**
- Maintainers will review:
  - Code quality and adherence to architecture
  - Test coverage
  - Documentation completeness
  - Security implications
- Address review comments promptly
- Squash commits before merge (if requested)

### 5. Vibe Coding Review
We encourage rapid development ("vibe coding"), BUT:
- Your code WILL be reviewed before merge
- Be ready to refactor if architecture is violated
- Tests are still required
- Document your "vibe" decisions in PR description

## Project Structure Guidelines

### Adding a New Pipeline Stage
1. Create stage file in `backend/app/pipeline/stages/`
2. Inherit from `BasePipelineStage`
3. Implement `execute()` method
4. Add stage to pipeline configuration
5. Write integration test

### Adding a New Tool Integration
1. Add wrapper in `backend/app/integrations/`
2. Use `subprocess_runner.py` utility
3. Handle all error cases
4. Return structured data (dict/dataclass)
5. Add logging

### Adding API Endpoints
1. Create route in `backend/app/api/routes/`
2. Define Pydantic schemas in `backend/app/schemas/`
3. Add authentication if needed
4. Document with OpenAPI annotations
5. Write API tests

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=backend/app --cov-report=html

# Run specific test file
pytest tests/test_pipeline.py

# Run integration tests (requires Docker)
pytest tests/integration/
```

## Code Style

We use:
- **Black** for formatting (line length: 100)
- **isort** for import sorting
- **mypy** for static type checking
- **flake8** for linting

```bash
# Auto-format code
black backend/
isort backend/

# Check types
mypy backend/

# Lint
flake8 backend/
```

## Security Guidelines

- Never commit real scan results
- Never commit API keys or tokens
- Use environment variables for secrets
- Sanitize user inputs
- Follow OWASP guidelines for web security
- Report security issues privately to maintainers

## Documentation

- Update `docs/` for architecture changes
- Add docstrings to all public functions/classes
- Include examples in docstrings
- Update API docs for endpoint changes

## Questions?

- Open an issue with the `question` label
- Join our [Discord/Slack] (if applicable)
- Check existing issues and docs first

---

**Remember**: Quality over quantity. Small, focused PRs are better than large, sprawling ones.

Happy hacking! 🚀
