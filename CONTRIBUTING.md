# Contributing to Anovex Protocol

Thank you for your interest in contributing to Anovex Protocol! We welcome contributions from the community.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/Anovexdev/anovex-zk-core/issues)
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, Node version, etc.)

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain why it would benefit Anovex users

### Pull Requests

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Add tests if applicable
5. Ensure all tests pass: `npm test`
6. Commit with clear messages: `git commit -m "Add feature: description"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

```bash
# Clone repository
git clone https://github.com/Anovexdev/anovex-zk-core.git
cd anovex-zk-core

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

## Coding Standards

- Use TypeScript for type safety
- Follow existing code style
- Add JSDoc comments for public APIs
- Keep functions focused and testable
- Use meaningful variable names

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Commit Message Guidelines

Format: `type(scope): description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
- `feat(swap): add slippage tolerance setting`
- `fix(wallet): resolve encryption key derivation issue`
- `docs(api): update endpoint documentation`

## Questions?

Follow us on [X (Twitter)](https://x.com/anovexofficial) or email dev@anovex.io
