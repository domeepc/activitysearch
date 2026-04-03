import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    name: v.string(),
    lastname: v.string(),
    username: v.string(),
    slug: v.string(),
    description: v.string(),
    email: v.string(),
    contact: v.string(),
    avatar: v.string(),
    totalExp: v.int64(),
    loyaltyPoints: v.optional(v.int64()),
    friends: v.array(v.id("users")),
    blocked: v.optional(v.array(v.id("users"))),
    role: v.optional(v.string()),
    lastActive: v.optional(v.number()),
    publicKey: v.optional(v.string()),
  })
    .index("byExternalId", ["externalId"])
    .index("byUsername", ["username"])
    .index("bySlug", ["slug"]),

  organisations: defineTable({
    organisationName: v.string(),
    organisationEmail: v.string(),
    address: v.string(),
    longitude: v.float64(),
    latitude: v.float64(),
    description: v.string(),
    IBAN: v.string(),
    organisersIDs: v.array(v.id("users")),
    activityIDs: v.array(v.id("activities")),
    stripeAccountId: v.optional(v.string()),
    stripeAccountOnboardingComplete: v.optional(v.boolean()),
  }),

  teams: defineTable({
    teamName: v.string(),
    teamDescription: v.string(),
    teammates: v.array(v.id("users")),
    admins: v.optional(v.array(v.id("users"))),
    createdBy: v.id("users"),
    slug: v.string(),
    icon: v.optional(v.string()),
    teamPublicKey: v.optional(v.string()),
  }).index("bySlug", ["slug"]),

  reviews: defineTable({
    text: v.string(),
    rating: v.optional(v.float64()),
    userId: v.id("users"),
    activityId: v.id("activities"),
  }).index("byUserAndActivity", ["userId", "activityId"]),
  quests: defineTable({
    questType: v.optional(
      v.union(v.literal("manual"), v.literal("system"))
    ),
    questName: v.string(),
    expAmount: v.int64(),
    description: v.string(),
    iconSvg: v.optional(v.string()),
    /** Public HTTPS URL (e.g. Convex file storage) shown on activity page */
    iconImageUrl: v.optional(v.string()),
    activityId: v.optional(v.id("activities")),
    systemKey: v.optional(
      v.union(
        v.literal("account_created"),
        v.literal("avatar_set"),
        v.literal("team_created"),
        v.literal("friend_added"),
        v.literal("activity_reserved")
      )
    ),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  })
    .index("byActivity", ["activityId"])
    .index("bySystemKey", ["systemKey"]),
  questCompletions: defineTable({
    userId: v.id("users"),
    questId: v.id("quests"),
    completedAt: v.number(),
    source: v.union(v.literal("manual"), v.literal("system")),
    markedByOrganiserId: v.optional(v.id("users")),
  })
    .index("by_user_quest", ["userId", "questId"])
    .index("by_user", ["userId"])
    .index("by_quest", ["questId"]),
  loyaltyTransactions: defineTable({
    userId: v.id("users"),
    amount: v.int64(),
    reason: v.string(),
    reservationId: v.optional(v.id("reservations")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  reservations: defineTable({
    date: v.string(),
    time: v.string(),
    userCount: v.int64(),
    activityId: v.id("activities"),
    teamIds: v.array(v.id("teams")),
    createdBy: v.id("users"),
    readByOrganiser: v.optional(v.boolean()),
    reservationChatId: v.optional(v.id("conversations")),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    paymentStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("on_hold"),
        v.literal("fulfilled"),
        v.literal("cancelled")
      )
    ),
    paymentDeadline: v.optional(v.number()),
    loyaltyDiscountTotal: v.optional(v.float64()),
    loyaltyPointsSpent: v.optional(v.int64()),
  })
    .index("byActivity", ["activityId"])
    .index("byDateTime", ["activityId", "date", "time"]),
  reservationPayments: defineTable({
    reservationId: v.id("reservations"),
    userId: v.id("users"),
    amount: v.float64(),
    personsPaidFor: v.int64(),
    paidAt: v.number(),
    refundedAt: v.optional(v.number()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeSetupIntentId: v.optional(v.string()), // SetupIntent for collecting payment method
    stripePaymentMethodId: v.optional(v.string()), // Payment method ID from SetupIntent
    capturedAt: v.optional(v.number()),
    captureScheduledFor: v.optional(v.number()),
  }).index("byReservation", ["reservationId"]),
  reservationQueue: defineTable({
    activityId: v.id("activities"),
    date: v.string(),
    teamIds: v.array(v.id("teams")),
    userCount: v.int64(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    notifiedAt: v.optional(v.number()),
  }).index("byActivityDate", ["activityId", "date"]),
  conversations: defineTable({
    user1Id: v.id("users"),
    user2Id: v.id("users"),
    createdAt: v.number(),
    reservationId: v.optional(v.id("reservations")),
  })
    .index("byUser1", ["user1Id"])
    .index("byUser2", ["user2Id"]),
  messages: defineTable({
    text: v.string(),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    readBy: v.optional(v.array(v.id("users"))),
    encrypted: v.optional(v.boolean()),
    encryptionVersion: v.optional(v.union(v.literal("symmetric"), v.literal("asymmetric"))),
  })
    .index("byConversation", ["senderId", "receiverId"])
    .index("byReceiver", ["receiverId"]),
  groupMessages: defineTable({
    text: v.string(),
    senderId: v.id("users"),
    teamId: v.id("teams"),
    readBy: v.optional(v.array(v.id("users"))),
    encrypted: v.optional(v.boolean()),
    encryptionVersion: v.optional(v.union(v.literal("symmetric"), v.literal("asymmetric"))),
    messageType: v.optional(
      v.union(v.literal("text"), v.literal("reservation_card"))
    ),
    reservationCardData: v.optional(
      v.object({
        reservationId: v.id("reservations"),
      })
    ),
  }).index("byTeam", ["teamId"]),
  activities: defineTable({
    activityName: v.string(),
    description: v.string(),
    address: v.string(),
    longitude: v.float64(),
    latitude: v.float64(),
    price: v.float64(),
    duration: v.int64(),
    difficulty: v.string(),
    maxParticipants: v.int64(),
    minAge: v.int64(),
    tags: v.array(v.string()),
    rating: v.optional(v.float64()),
    reviewCount: v.optional(v.int64()),
    equipment: v.array(v.string()),
    images: v.optional(v.array(v.string())),
    availableTimeSlots: v.optional(v.array(v.string())),
    organisationId: v.optional(v.id("organisations")),
  }),
});
