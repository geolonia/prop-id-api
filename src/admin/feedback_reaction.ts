import { APIGatewayProxyEvent } from 'aws-lambda';
import { URLSearchParams } from 'url';
import axios from 'axios';
import { createLog, getLog } from '../lib/dynamodb_logs';

export const _handler = async (event: APIGatewayProxyEvent) => {
  const { body } = event;
  if (!body) {
    throw new Error('Invalid body');
  }
  const payload = JSON.parse(new URLSearchParams(body).get('payload') || '');
  const { actions: [ { action_id, value } ], response_url, user, message: { blocks } } = payload;
  const { logId: { PK, SK } } = JSON.parse(value);

  if (!(await getLog(PK, SK))) {
    throw new Error('Invalid log identifiers.');
  }

  let review: string;
  let reviewText: string;
  blocks.pop();

  if (action_id === 'markAsResolved') {
    review = 'resolved';
    reviewText = `修正依頼は <@${user.id}> によって処理済みとしてマークされました。`;
  } else if (action_id === 'markAsInvalid') {
    review = 'resolved';
    reviewText = `修正依頼は <@${user.id}> によって拒絶されました。`;
  } else {
    throw new Error(`Unknown action_id ${action_id}.`);
  }
  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: reviewText,
      },
    },
  );
  await Promise.all([
    createLog('feedbackRequestReview', { feedbackLogId: { PK, SK }, review, slack_user: user.id }),
    axios.post(response_url, {
      delete_original: true,
      response_type: 'in_channel',
      text: review,
      blocks,
    }),
  ]);

  return {
    isBase64Encoded: false,
    statusCode: 204,
    body: '',
  };
};

export const handler = _handler;

