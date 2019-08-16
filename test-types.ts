
// This file exists only so that we can run the TypeScript compiler in the CI build
// to validate our index.d.ts file.

import ConsulFeatureStore, { LDConsulOptions } from 'launchdarkly-node-server-sdk-consul';
import { LDLogger } from 'launchdarkly-node-server-sdk';

var emptyOptions: LDConsulOptions = {};

var logger: LDLogger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };

var options: LDConsulOptions = {
	consulOptions: {},
	prefix: 'x',
	cacheTTL: 30,
	logger: logger
};
