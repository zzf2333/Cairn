type: decision
domain: api-gateway
decision_date: 2024-01
recorded_date: 2024-01
summary: Chose AWS SQS for async job queue over Kafka; throughput requirements do not justify broker ops
rejected: Apache Kafka — evaluated for the async job queue backing email notifications, webhook
  deliveries, and export jobs. Kafka's log-based architecture and consumer groups are the right
  model for high-throughput event streaming (> 100k events/sec) or multi-consumer fan-out.
  Our current peak async job volume is ~8,000 jobs/day. Kafka would require a managed broker
  (MSK: ~$400/month minimum) or self-hosted (requires dedicated ops). RabbitMQ was also evaluated
  and rejected — AMQP protocol adds driver complexity vs SQS SDK, and RabbitMQ self-hosted has
  the same ops overhead concern as Kafka. Google Pub/Sub was not evaluated (cloud lock-in concern,
  already committed to AWS).
reason: SQS at 8,000 jobs/day costs ~$0.40/month. MSK at the same volume costs ~$400/month.
  At 500× cost difference, SQS is the only defensible choice. SQS FIFO queues cover ordering
  requirements for webhook delivery. Dead-letter queues cover retry/failure visibility without
  a separate monitoring stack. The team is already familiar with the AWS SDK. Kafka should not
  be introduced until throughput requirements are at least 10× current peak volume.
revisit_when: async job volume > 100k/day sustained OR multi-consumer fan-out required for
  the same event stream (e.g., audit log + notification + analytics from one event)
