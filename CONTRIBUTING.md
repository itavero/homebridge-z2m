# Contributing to homebridge-z2m

First of all, thank you for considering making a contribution to this project.

This document contains guidelines for contributing to this Homebridge plugin, as well as references that might be useful.

There are [multiple ways you can contribute to this project](https://opensource.guide/how-to-contribute/) and it doesn't necessarily mean writing code. A few ways you can contribute are:
* Filing detailed bug reports (if you happen to run into one)
* Helping other users with questions they have
* Propose awesome new features
* Fix bugs (in code and/or documentation)
* Implement new features
* If you like this plugin, tell others about it.

When contributing to this project, please follow the [Code of Conduct](CODE_OF_CONDUCT.md) as well as the [etiquette](https://github.com/kossnocorp/etiquette/blob/master/README.md).

## Bug Reports and Feature Requests

Reporting bugs or proposing new features should be done via the [issues section](http://github.com/itavero/homebridge-z2m/issues) of the GitHub repository.

Before opening up a new issue, please check if someone else did not already report the bug or proposed a similar feature.
If a similar issue already exists, but has not yet been resolved, check if you can add additional information or use cases that might help with resolving the issue. If you don't have any relevant information, but just want to indicate that you are facing a similar problem or like/dislike the proposed feature, please add a [reaction](https://github.com/blog/2119-add-reactions-to-pull-requests-issues-and-comments), instead of a "+1" / comment:

- :+1: - upvote
- :-1: - downvote

If you can't find a related issue, you can open up a new one. Please use the available templates when doing so and try to fill in all of the requested information/answers.

## Contributing Code

This plugin is written in TypeScript. It tries to adhere to the [requirements for a Homebridge Verified Plugin](https://github.com/homebridge/verified#requirements).

Since it's a plugin for Homebridge, their [developer documentation](https://developers.homebridge.io/) tends to be a good reference to figure out how services and characteristics relate to each other and which predefined services and characteristics exist.

For information on how this plugin is structured internally, please see the [Architecture Documentation](docs/architecture.md).

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/itavero/homebridge-z2m.git
   cd homebridge-z2m
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Run tests in watch mode during development:
   ```bash
   npm run watch:test
   ```

### Pull Request Requirements

When submitting a pull request, please ensure your contribution includes:

#### 1. Unit Tests

All code changes should be accompanied by unit tests that verify the behavior. Tests are written using [Vitest](https://vitest.dev/) and located in the `test/` directory.

**Test patterns:**
- Create test files named `*.spec.ts` in the `test/` directory
- Use the `ServiceHandlersTestHarness` from `test/testHelpers.ts` for testing converters
- Test both MQTT-to-HomeKit state updates and HomeKit-to-MQTT commands
- See existing tests like `test/switch.spec.ts` or `test/light.spec.ts` for examples

**Using device exposes in tests:**

Tests typically use exposes data from known device models. To get exposes JSON files for testing:

1. Run the documentation generation script locally:
   ```bash
   ./generate-docs.sh
   ```
2. This extracts exposes data from zigbee-herdsman-converters and creates JSON files in:
   - `exposes/` (for documentation)
   - `test/exposes/` (for tests)
3. Load the exposes in your test:
   ```typescript
   const exposes = loadExposesFromFile('vendor/model.json');
   ```
4. For custom exposes not from zigbee-herdsman-converters, place them in `test/exposes/_manual/`

**Running tests:**
```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run watch:test

# View coverage report
npm run coverage
```

#### 2. Documentation Updates

For user-facing changes, update the relevant documentation in the `docs/` folder:

- **New service handlers**: Create a new markdown file (e.g., `docs/fan.md`) and add it to `docs/converters.md`
- **Configuration changes**: Update `docs/config.md` and ensure `config.schema.json` is updated
- **Behavior changes**: Update the relevant service documentation

#### 3. Changelog Entry

Update `CHANGELOG.md` with a description of your changes under the `[Unreleased]` section. Follow the existing format:

```markdown
## [Unreleased]

### Added
- New feature description (#issue-number)

### Changed
- Changed behavior description (#issue-number)

### Fixed
- Bug fix description (#issue-number)
```

Categories to use:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Features that will be removed in future versions
- **Removed**: Features that have been removed
- **Fixed**: Bug fixes
- **Security**: Security-related changes

### Code Style

- Follow the existing code style in the project
- Run the linter before submitting:
  ```bash
  npm run lint
  ```
- Auto-fix linting issues:
  ```bash
  npm run lint-fix
  ```

### Commit Messages

- Use clear, descriptive commit messages
- Reference issue numbers where applicable (e.g., "Fix brightness handling for dimmable lights (#123)")

### Testing Your Changes

Before submitting, ensure:

1. **All tests pass**: `npm test`
2. **No linting errors**: `npm run lint`
3. **Build succeeds**: `npm run build`

For integration testing with a real Homebridge instance:
```bash
npm run start
```

For smoke testing with a mock MQTT broker:
```bash
npm run smoke-test
```

## Adding Support for New Device Types

If you're adding support for a new device type or service, please refer to the [Architecture Documentation](docs/architecture.md) which includes:

- Detailed explanation of the plugin architecture
- Step-by-step guide for creating new service handlers
- Test patterns and examples
- Common patterns for multi-endpoint devices and configuration

## Questions?

If you have specific questions, feel free to ask them via the GitHub issue section or on the `z2m` channel on the [Homebridge Discord server](https://discord.gg/homebridge).
