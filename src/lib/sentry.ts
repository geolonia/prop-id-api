// import/no-extraneous-dependencies is disabled because @sentry/serverless is vended via a Lambda Layer
// eslint-disable-next-line import/no-extraneous-dependencies
import * as Sentry from '@sentry/serverless';

const initOptions: Sentry.AWSLambda.NodeOptions = {
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.05,
  release: process.env.RELEASE_VER,
};

if (process.env.STAGE) {
  initOptions.environment = process.env.STAGE;
}

Sentry.AWSLambda.init(initOptions);

export default Sentry;
