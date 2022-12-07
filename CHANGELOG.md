# Change log

All notable changes to the LaunchDarkly Node.js SDK Consul integration will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org).

## [2.1.0] - 2022-12-07
### Added:
- Added support for `launchdarkly-node-server-sdk` `7.0.0` and greater.

## [2.0.0] - 2021-06-17
The 2.0.0 release of `launchdarkly-node-server-sdk-consul` is for use with version 6.x of the LaunchDarkly server-side SDK for Node.js. It has the same functionality as the previous major version, but its dependencies, Node version compatibility, and internal API have been updated to match the 6.0.0 release of the SDK.

This version uses the same Consul client package as previous releases.

### Changed:
- The minimum Node.js version is now 12.
- The package no longer has a dependency on `winston`. It still allows you to configure a custom logger, but if you do not, it will use whatever logging configuration the SDK is using.

## [1.0.5] - 2020-03-25
### Removed:
- The package dependencies mistakenly included `typedoc`.

## [1.0.4] - 2020-02-12
### Fixed:
- If diagnostic events are enabled (in Node SDK 5.11.0 and above), the SDK will correctly report its data store type as &#34;Consul&#34; rather than &#34;custom&#34;. This change has no effect in earlier versions of the Node SDK.

## [1.0.3] - 2019-08-18
### Added:
- Generated HTML documentation.

## [1.0.2] - 2019-08-16
### Fixed:
- The package could not be used from TypeScript due to a mislabeled default export.

## [1.0.1] - 2019-05-14
### Changed:
- Corresponding to the SDK package name change from `ldclient-node` to `launchdarkly-node-server-sdk`, this package is now called `launchdarkly-node-server-sdk-consul`. The functionality of the package, including the namespaces and class names, has not changed.

## [1.0.0] - 2019-01-14

Initial release.

