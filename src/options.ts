import { LDLogger } from 'launchdarkly-node-server-sdk';

/**
 * Options for configuring a [[ConsulFeatureStore]].
 */
export interface LDConsulOptions {
  /**
   * Options to be passed to the Consul client constructor, as defined by the node-consul package.
   * Commonly used options include "host" (hostname), "port", and "secure" (true to use HTTPS).
   * For other options, see `node-consul` documentation here: https://github.com/silas/node-consul
   */
  consulOptions?: { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  // Note, the node-consul library provides no TypeScript types, hence the type is vague here

  /**
   * An optional namespace prefix for all keys stored in Consul. Use this if you are sharing
   * the same Consul host between multiple clients that are for different LaunchDarkly
   * environments, to avoid key collisions. 
   */
  prefix?: string;

  /**
   * The expiration time for local caching, in seconds. To disable local caching, set this to zero.
   * If not specified, the default is 15 seconds.
   */
  cacheTTL?: number;

  /**
   * A logger to be used for warnings and errors generated by the feature store. If not specified,
   * it will use the SDK's logging configuration.
   */
  logger?: LDLogger;
}
