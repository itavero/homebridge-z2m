# Contributing to homebridge-z2m

First of all, thank you for considering making a contribution to this project. 👍

This document contains some guidelines for contributing to this Homebridge plugin, as well as some references that might be useful.

There are [multiple ways you can contribute to this project](https://opensource.guide/how-to-contribute/) and it doesn't necessarily mean writing code. A few ways you can contribute are:
* Filing detailed bug reports (if you happen to run in to one)
* Helping other users with questions they have
* Propose awesome new features
* Fix bugs (in code and/or documentation)
* Implement new features
* If you like this plugin, tell others about it.

When contributing to this project, please follow the [Code of Conduct](CODE_OF_CONDUCT.md) as well as the [etiquette](https://github.com/kossnocorp/etiquette/blob/master/README.md).

## Bug reports and feature requests

Reporting bugs or proposing new features should be done via the [issues section](http://github.com/itavero/homebridge-z2m/issues) of the GitHub repository.

Before opening up a new issue, please check if someone else did not already report the bug or proposed a similar feature.
If an similar issue already exists, but has not yet been resolved, check if you can add additional information or use cases that might help with resolving the issue. If you don't have any relevant information, but just want to indicate that you are facing a similar problem or like/dislike the proposed feature, please add a [reaction](https://github.com/blog/2119-add-reactions-to-pull-requests-issues-and-comments), instead of a "+1" / comment, like this:

👍 - upvote

👎 - downvote

If you can't find a related issue, you can open up a new one. Please use the available templates when doing so and try to fill in all of the requested information/answers.

## Contributing code

This plugin is written in TypeScript. It tries to adhere to the [requirements for a Homebridge Verified Plugin](https://github.com/homebridge/verified#requirements).

Since it's a plugin for Homebridge, their [developer documentation](https://developers.homebridge.io/) tends to be a good reference to figure out how services and characteristics relate to each other and which predefined services and characteristics exist.

Unfortunately, at this point in time, there is no documentation on how this plugin is structured internally (other than the code itself). If you have specific questions, feel free to ask them via the GitHub issue section or on the `z2m` channel on the Homebridge Discord server.

### Pull Requests

Some automation is put in place to perform some automated checks on a pull request. If you change code, please try to add automated tests to verify the behavior (see the `test` folder).