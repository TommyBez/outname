import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const waitlistEntry = pgTable(
  'waitlist_entries',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    useCase: text('use_case'),
    primaryInterest: text('primary_interest'),
    profileType: text('profile_type'),
    status: text('status').notNull().default('pending'),
    source: text('source'),
    referrer: text('referrer'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    confirmationTokenHash: text('confirmation_token_hash'),
    confirmationTokenExpiresAt: timestamp('confirmation_token_expires_at', {
      withTimezone: true,
    }),
    confirmationEmailSentAt: timestamp('confirmation_email_sent_at', {
      withTimezone: true,
    }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    inviteEmailSentAt: timestamp('invite_email_sent_at', {
      withTimezone: true,
    }),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    provisionedUserId: text('provisioned_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    provisionedAt: timestamp('provisioned_at', { withTimezone: true }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('waitlist_entries_email_idx').on(t.email),
    index('waitlist_entries_status_created_idx').on(
      t.status,
      t.createdAt.desc()
    ),
    index('waitlist_entries_source_created_idx').on(
      t.source,
      t.createdAt.desc()
    ),
    index('waitlist_entries_primary_interest_created_idx').on(
      t.primaryInterest,
      t.createdAt.desc()
    ),
    index('waitlist_entries_profile_type_created_idx').on(
      t.profileType,
      t.createdAt.desc()
    ),
  ]
)

export type WaitlistEntry = typeof waitlistEntry.$inferSelect
export type NewWaitlistEntry = typeof waitlistEntry.$inferInsert

export const waitlistLaunchEmailDelivery = pgTable(
  'waitlist_launch_email_deliveries',
  {
    id: text('id').primaryKey(),
    waitlistEntryId: text('waitlist_entry_id')
      .notNull()
      .references(() => waitlistEntry.id, {
        onDelete: 'cascade',
      }),
    eventKey: text('event_key').notNull(),
    resendMessageId: text('resend_message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('waitlist_launch_email_delivery_unique_idx').on(
      t.waitlistEntryId,
      t.eventKey
    ),
    index('waitlist_launch_email_delivery_event_idx').on(
      t.eventKey,
      t.sentAt.desc()
    ),
  ]
)

export type WaitlistLaunchEmailDelivery =
  typeof waitlistLaunchEmailDelivery.$inferSelect
export type NewWaitlistLaunchEmailDelivery =
  typeof waitlistLaunchEmailDelivery.$inferInsert
