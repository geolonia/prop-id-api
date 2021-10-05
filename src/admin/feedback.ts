import { createLog } from '../lib/dynamodb_logs';
import { errorResponse, json } from '../lib/proxy-response';
import type { IncomingWebhookSendArguments } from '@slack/webhook';
import { sendSlackNotification } from '../lib/slack';
import { auth0ManagementClient } from '../lib/auth0_client';

export const create: AdminHandler = async (event) => {
  const rawBody = event.body;
  const body = JSON.parse(rawBody || '');
  const feedback = body.feedback;

  if (!feedback) {
    return errorResponse(422, 'please submit feedback');
  }

  const auth0 = await auth0ManagementClient();
  const user = await auth0.getUser({id: event.userId});

  await createLog('feedbackRequest', {
    userId: event.userId,
    userEmail: user.email,
    feedback,
  });

  const channels = {
    local: 'dev-propid-id-notifications-dev',
    dev: 'dev-propid-id-notifications-dev',
    v1: 'dev-propid-id-notifications',
  };

  const feedbackTypes: { [key: string]: string } = {
    'idMerge': 'IDの統合依頼',
    'locationFix': '緯度経度修正依頼',
    'nameChange': '地名・住所・ビル名変更依頼',
  };

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
          text: `*不動産共通ID*\n\`${feedback.id}\``,
        },
        {
          type: 'mrkdwn',
          text: `*IDの現住所*\n${feedback.currentAddress}`,
        },
      ],
    },
  ];

  if (feedback.feedbackType === 'idMerge') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${feedbackTypes[feedback.feedbackType] || feedback.feedbackType}*`,
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*統合が必要なIDのリスト*\n${feedback.idMerge?.list}`,
        },
        {
          type: 'mrkdwn',
          text: `*同じ物件であることの確認方法*\n${feedback.idMerge?.confirm}`,
        },
      ],
    });
  } else if (feedback.feedbackType === 'locationFix') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${feedbackTypes[feedback.feedbackType] || feedback.feedbackType}*`,
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*修正後の緯度と経度*\n\`${feedback.locationFix?.latLng}\``,
        },
        {
          type: 'mrkdwn',
          text: `*建物の場所の確認方法*\n${feedback.locationFix?.confirm}`,
        },
      ],
    });
  } else if (feedback.feedbackType === 'nameChange') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${feedbackTypes[feedback.feedbackType] || feedback.feedbackType}*`,
      },
      fields: [
        {
          type: 'mrkdwn',
          text: `*変更内容*\n${feedback.nameChange?.contents}`,
        },
        {
          type: 'mrkdwn',
          text: `*地名変更、住所変更の確認方法*\n${feedback.nameChange?.confirm}`,
        },
      ],
    });
  }

  await sendSlackNotification({
    channel: channels[process.env.STAGE],
    blocks,
  });

  return json({
    error: false,
  });
};
