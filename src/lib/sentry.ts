import * as Sentry from '@sentry/serverless';

const initOptions: Sentry.AWSLambda.NodeOptions = {
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  release: process.env.RELEASE_VER,
};

if (process.env.STAGE) {
  initOptions.environment = process.env.STAGE;
}

Sentry.AWSLambda.init(initOptions);

export default Sentry;
