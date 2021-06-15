# LaunchDarkly Server-Side SDK for Node.js - Consul integration

[![CircleCI](https://circleci.com/gh/launchdarkly/node-server-sdk-consul.svg?style=svg)](https://circleci.com/gh/launchdarkly/node-server-sdk-consul)

This library provides a Consul-backed persistence mechanism (feature store) for the [LaunchDarkly server-side Node.js SDK](https://github.com/launchdarkly/node-server-sdk), replacing the default in-memory feature store. It uses the [consul](https://www.npmjs.com/package/consul) package.

The minimum version of the LaunchDarkly Node.js SDK for use with this library is 6.0.0.

For more information, see the [SDK features guide](https://docs.launchdarkly.com/sdk/features/database-integrations).

TypeScript API documentation is [here](https://launchdarkly.github.io/node-server-sdk-consul).

## Quick setup

This assumes that you have already installed the LaunchDarkly Node.js SDK.

1. Install this package with `npm`:

        npm install launchdarkly-node-server-sdk-consul --save

2. Require the package:

        var ConsulFeatureStore = require('launchdarkly-node-server-sdk-consul');

3. When configuring your SDK client, add the Consul feature store:

        var store = ConsulFeatureStore({ consulOptions: { host: 'your-consul-host' } });
        var config = { featureStore: store };
        var client = LaunchDarkly.init('YOUR SDK KEY', config);

4. If you are running a [LaunchDarkly Relay Proxy](https://github.com/launchdarkly/ld-relay) instance, or any other process that will prepopulate Consul with feature flags from LaunchDarkly, you can use [daemon mode](https://github.com/launchdarkly/ld-relay#daemon-mode), so that the SDK retrieves flag data only from Consul and does not communicate directly with LaunchDarkly. This is controlled by the SDK's `useLdd` option:

        var config = { featureStore: store, useLdd: true };
        var client = LaunchDarkly.init('YOUR SDK KEY', config);

5. If the same Consul host is being shared by SDK clients for different LaunchDarkly environments, set the `prefix` option to a different short string for each one to keep the keys from colliding:

        var store = ConsulFeatureStore({ consulOptions: { host: 'your-consul-host' }, prefix: 'env1' });

## Caching behavior

To reduce traffic to Consul, there is an optional in-memory cache that retains the last known data for a configurable amount of time. This is on by default; to turn it off (and guarantee that the latest feature flag data will always be retrieved from Consul for every flag evaluation), configure the store as follows:

        var store = ConsulFeatureStore('YOUR TABLE NAME', { cacheTTL: 0 });

## About LaunchDarkly

* LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard.  With LaunchDarkly, you can:
    * Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
    * Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
    * Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
    * Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
* LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/docs) for a complete list.
* Explore LaunchDarkly
    * [launchdarkly.com](https://www.launchdarkly.com/ "LaunchDarkly Main Website") for more information
    * [docs.launchdarkly.com](https://docs.launchdarkly.com/  "LaunchDarkly Documentation") for our documentation and SDK reference guides
    * [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/  "LaunchDarkly API Documentation") for our API documentation
    * [blog.launchdarkly.com](https://blog.launchdarkly.com/  "LaunchDarkly Blog Documentation") for the latest product updates
