import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const launchSocialPostDelivery = pgTable(
  'launch_social_post_deliveries',
  {
    id: text('id').primaryKey(),
    launchKey: text('launch_key').notNull(),
    postId: text('post_id').notNull(),
    platform: text('platform').notNull(),
    connectorId: text('connector_id').notNull(),
    socialSetId: text('social_set_id').notNull(),
    typefullyDraftId: text('typefully_draft_id'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('launch_social_post_delivery_unique_idx').on(
      t.launchKey,
      t.postId
    ),
    index('launch_social_post_delivery_launch_idx').on(
      t.launchKey,
      t.createdAt.desc()
    ),
  ]
)

export type LaunchSocialPostDelivery =
  typeof launchSocialPostDelivery.$inferSelect
export type NewLaunchSocialPostDelivery =
  typeof launchSocialPostDelivery.$inferInsert

export const launchAdminDigestDelivery = pgTable(
  'launch_admin_digest_deliveries',
  {
    id: text('id').primaryKey(),
    launchKey: text('launch_key').notNull(),
    digestKey: text('digest_key').notNull(),
    resendMessageId: text('resend_message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('launch_admin_digest_delivery_unique_idx').on(
      t.launchKey,
      t.digestKey
    ),
    index('launch_admin_digest_delivery_launch_idx').on(
      t.launchKey,
      t.sentAt.desc()
    ),
  ]
)

export type LaunchAdminDigestDelivery =
  typeof launchAdminDigestDelivery.$inferSelect
export type NewLaunchAdminDigestDelivery =
  typeof launchAdminDigestDelivery.$inferInsert

export const launchFeedback = pgTable(
  'launch_feedback',
  {
    id: text('id').primaryKey(),
    launchKey: text('launch_key').notNull(),
    feedbackType: text('feedback_type').notNull(),
    message: text('message').notNull(),
    email: text('email'),
    referrer: text('referrer'),
    source: text('source'),
    userAgent: text('user_agent'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmMedium: text('utm_medium'),
    utmSource: text('utm_source'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('launch_feedback_launch_created_idx').on(
      t.launchKey,
      t.createdAt.desc()
    ),
    index('launch_feedback_email_created_idx').on(t.email, t.createdAt.desc()),
  ]
)

export type LaunchFeedback = typeof launchFeedback.$inferSelect
export type NewLaunchFeedback = typeof launchFeedback.$inferInsert
