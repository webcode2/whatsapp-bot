import { PubSub } from '@google-cloud/pubsub';
import pino from 'pino';

const logger = pino();
const pubSubClient = new PubSub();

/**
 * Safely publishes a message to a Pub/Sub topic.
 */
export const safePubSubPublish = async (topicName: string, payload: object): Promise<string> => {
  try {
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    const messageId = await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
    logger.info({ topicName, messageId }, 'Pub/Sub message published');
    return messageId;
  } catch (error) {
    logger.error({ error, topicName }, 'Failed to publish Pub/Sub message');
    throw error;
  }
};
