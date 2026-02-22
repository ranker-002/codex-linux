# Code Review Guidelines

When reviewing code, please follow these comprehensive guidelines:

## 1. Code Quality

### Readability
- Is the code easy to understand?
- Are variable and function names descriptive?
- Is the code properly formatted and indented?
- Are complex sections commented?

### Maintainability
- Is the code modular and reusable?
- Are functions small and focused?
- Is there appropriate separation of concerns?
- Are there any code smells or anti-patterns?

## 2. Functionality

### Correctness
- Does the code work as intended?
- Are edge cases handled properly?
- Are errors handled gracefully?
- Is input validated?

### Testing
- Are there adequate unit tests?
- Are integration tests included where needed?
- Is test coverage sufficient?
- Are edge cases tested?

## 3. Performance

### Efficiency
- Are there any obvious performance bottlenecks?
- Are expensive operations optimized?
- Is memory usage reasonable?
- Are loops and iterations efficient?

### Scalability
- Will the code scale with increased load?
- Are there any hard limits that could cause issues?
- Is caching used appropriately?

## 4. Security

### Best Practices
- Is user input sanitized?
- Are secrets and credentials properly handled?
- Are there SQL injection vulnerabilities?
- Is XSS prevention in place?

### Authentication & Authorization
- Are access controls properly implemented?
- Is authentication handled securely?
- Are sensitive operations properly protected?

## 5. Documentation

### Code Documentation
- Are public APIs documented?
- Are complex algorithms explained?
- Are there README files where needed?
- Is the documentation up to date?

### Comments
- Are comments clear and helpful?
- Do comments explain "why" not just "what"?
- Is there dead code or commented-out code?

## Review Checklist

Before approving, ensure:

- [ ] Code compiles/builds without errors
- [ ] Tests pass
- [ ] No console.log or debug statements left in production code
- [ ] No sensitive data exposed
- [ ] Documentation updated if needed
- [ ] Breaking changes documented
- [ ] Backward compatibility considered

## Communication

When providing feedback:

1. **Be Constructive**: Focus on the code, not the person
2. **Explain Why**: Provide reasoning for suggestions
3. **Suggest Solutions**: Don't just point out problems
4. **Acknowledge Good Work**: Highlight what was done well
5. **Be Specific**: Reference specific lines and provide examples

## Priority Levels

- **Critical**: Security vulnerabilities, data loss risks
- **High**: Major functionality issues, performance problems
- **Medium**: Code quality issues, missing tests
- **Low**: Style preferences, minor optimizations
- **Suggestion**: Alternative approaches, future improvements

Remember: The goal is to improve code quality while maintaining a positive, collaborative environment.