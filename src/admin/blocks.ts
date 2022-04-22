import { ActionsBlock, SectionBlock } from '@slack/types';

const feedbackTypes: { [key: string]: string } = {
  'idMerge': 'IDの統合依頼',
  'idSplit': 'IDの分割依頼',
  'locationFix': '緯度経度修正依頼',
  'nameChange': '地名・住所・ビル名変更依頼',
  'addBanchiGo': '番地または号の追加依頼',
};

export const idMergeBlock = (feedback: any) => {
  return {
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
  };
};

export const idSplitBlock = (feedback: any) => {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'test', // TODO: これを作る
    },
  };
};

export const locationFixBlock = (feedback: any) => {
  return {
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
  };
};

export const nameChangeBlock = (feedback: any) => {
  return {
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
  };
};

export const addBanchiGoBlock = (feedback: any) => {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${feedbackTypes[feedback.feedbackType] || feedback.feedbackType}*`,
    },
    fields: [
      {
        type: 'mrkdwn',
        text: `*新しい番地または号*\n${feedback.addBanchiGo?.contents}`,
      },
      {
        type: 'mrkdwn',
        text: `*地名変更、住所変更の確認方法*\n${feedback.addBanchiGo?.confirm}`,
      },
    ],
  };
};

export const markAsProcessedActionsBlocks = ({ PK, SK }: { PK: string, SK: string }): [SectionBlock, ActionsBlock] => {
  return [
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: 'この修正依頼に対応して以下のボタンを押してください。',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '完了済み',
          },
          style: 'primary',
          value: JSON.stringify({ logId: { PK, SK } }),
          action_id: 'markAsResolved',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '不正なリクエスト',
          },
          style: 'danger',
          value: JSON.stringify({ logId: { PK, SK } }),
          action_id: 'markAsInvalid',
        },
      ],
    },
  ];
};
