import { createLog } from '../lib/dynamodb_logs';
import { errorResponse, json } from '../lib/proxy-response';
import type { IncomingWebhookSendArguments } from '@slack/webhook';
import { sendSlackNotification } from '../lib/slack';
import { auth0ManagementClient } from '../lib/auth0_client';
import { addBanchiGoBlock, idMergeBlock, idSplitBlock, locationFixBlock, markAsProcessedActionsBlocks, nameChangeBlock } from './blocks';

export const create: AdminHandler = async (event) => {
  const rawBody = event.body;
  const body = JSON.parse(rawBody || '');
  const feedback = body.feedback;

  if (!feedback) {
    return errorResponse(422, 'please submit feedback');
  }

  const auth0 = await auth0ManagementClient();
  const user = await auth0.getUser({id: event.userId});

  const { PK, SK } = await createLog('feedbackRequest', {
    userEmail: user.email,
    feedback,
  }, {
    userId: event.userId,
  });

  const blocks: IncomingWebhookSendArguments['blocks'] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':writing_hand: *修正依頼が届きました*',
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*ユーザー*\nID: \`${event.userId}\`\nEmail: \`${user.email}\``,
        },
        {
          type: 'mrkdwn',
          text: `*不動産オープン ID*\n\`${feedback.id}\``,
        },
        {
          type: 'mrkdwn',
          text: `*IDの現住所*\n${feedback.currentAddress}`,
        },
      ],
    },
  ];

  if (feedback.feedbackType === 'idMerge') {
    blocks.push(
      idMergeBlock(feedback),
      ...markAsProcessedActionsBlocks({ PK, SK }),
    );
  } else if (feedback.feedbackType === 'idSplit') {
    blocks.push(
      idSplitBlock(feedback),
      ...markAsProcessedActionsBlocks({ PK, SK }),
    );
  } else if (feedback.feedbackType === 'locationFix') {
    blocks.push(
      locationFixBlock(feedback),
      ...markAsProcessedActionsBlocks({ PK, SK }),
    );
  } else if (feedback.feedbackType === 'nameChange') {
    blocks.push(
      nameChangeBlock(feedback),
      ...markAsProcessedActionsBlocks({ PK, SK }),
    );
  } else if (feedback.feedbackType === 'addBanchiGo') {
    blocks.push(
      addBanchiGoBlock(feedback),
      ...markAsProcessedActionsBlocks({ PK, SK }),
    );
  }

  await sendSlackNotification({ blocks });

  return json({
    error: false,
  });
};
