# Contributing to ExitZero

Thank you for your interest in contributing to ExitZero! We welcome contributions from the community and are grateful for your help in making this project better.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/exit-zero.git
   cd exit-zero
   ```
3. **Set up the development environment**:
   ```bash
   ./scripts/setup.sh
   ```
4. **Create a new branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account (for testing)

### Environment Setup
1. Copy the environment template:
   ```bash
   cp env.example .env.local
   ```
2. Fill in your environment variables (see README.md for details)
3. Set up your Supabase project and run the schema
4. Configure Stripe webhooks

### Running the Development Server
```bash
npm run dev
```

## 📝 Types of Contributions

### 🐛 Bug Reports
- Use the GitHub issue template
- Include steps to reproduce
- Provide environment details
- Add screenshots if applicable

### ✨ Feature Requests
- Check existing issues first
- Use the feature request template
- Explain the use case and benefits
- Consider implementation complexity

### 🔧 Code Contributions
- Follow the existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass

## 🎯 Areas for Contribution

### High Priority
- **AI Model Improvements**: Better prompt engineering, fallback strategies
- **Performance Optimization**: Bundle size reduction, API latency improvements
- **Integration Testing**: Automated tests for webhook flows
- **Documentation**: API docs, integration guides, tutorials

### Medium Priority
- **UI/UX Enhancements**: Dashboard improvements, mobile responsiveness
- **Analytics**: Better metrics, reporting features
- **Security**: Additional security measures, audit improvements
- **Monitoring**: Better error tracking, performance monitoring

### Low Priority
- **Internationalization**: Multi-language support
- **Advanced Features**: Custom AI models, enterprise features
- **Mobile Apps**: React Native or Flutter apps
- **Desktop Apps**: Electron wrapper

## 📋 Pull Request Process

1. **Update your branch** with the latest changes:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run tests** to ensure everything works:
   ```bash
   npm test
   npm run type-check
   npm run lint
   ```

3. **Commit your changes** with a clear message:
   ```bash
   git commit -m "feat: add new retention offer type"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** with:
   - Clear title and description
   - Reference related issues
   - Screenshots for UI changes
   - Test results

## 🎨 Code Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for complex functions

### React Components
- Use functional components with hooks
- Follow the existing component structure
- Use Tailwind CSS for styling
- Keep components small and focused

### API Endpoints
- Use proper HTTP status codes
- Include error handling
- Add input validation
- Document API changes

### Database
- Use Supabase best practices
- Follow the existing schema patterns
- Add proper indexes
- Use Row Level Security (RLS)

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Manual Testing
- Test with real Stripe webhooks
- Verify AI copy generation
- Check modal functionality
- Test data export features

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for functions
- Include examples in comments
- Document complex algorithms
- Explain business logic

### API Documentation
- Update API endpoint documentation
- Include request/response examples
- Document error codes
- Add integration examples

### User Documentation
- Update README.md for new features
- Add setup guides
- Create troubleshooting docs
- Write integration tutorials

## 🏷️ Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(api): add churn prediction endpoint
fix(modal): resolve mobile responsiveness issue
docs(readme): update installation instructions
test(integration): add webhook flow tests
```

## 🐛 Issue Templates

### Bug Report
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g. macOS, Windows, Linux]
- Node.js version: [e.g. 18.17.0]
- Browser: [e.g. Chrome, Safari]

**Additional context**
Add any other context about the problem.
```

### Feature Request
```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request.
```

## 🤝 Community Guidelines

### Be Respectful
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

### Be Collaborative
- Help others when you can
- Share knowledge and resources
- Work together to solve problems
- Give credit where it's due

### Be Professional
- Keep discussions on-topic
- Avoid spam or self-promotion
- Follow the code of conduct
- Report inappropriate behavior

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Discord**: For real-time chat (link in README)
- **Email**: support@exitzero.com for private matters

## 🎉 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation
- Community highlights

Thank you for contributing to ExitZero! 🚀
