import type { TopicConfig } from '../types/protocol'
import topic1Raw from '@topics/topic_1.json'
import topic2Raw from '@topics/topic_2.json'
import topic3Raw from '@topics/topic_3.json'

export const TOPICS: TopicConfig[] = [
  topic1Raw as TopicConfig,
  topic2Raw as TopicConfig,
  topic3Raw as TopicConfig,
]

export const DEFAULT_TOPIC = TOPICS[0]
