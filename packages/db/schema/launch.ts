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
