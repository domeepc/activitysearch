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
    friends: v.array(v.id("users")),
    blocked: v.optional(v.array(v.id("users"))),
    role: v.optional(v.string()),
    lastActive: v.optional(v.number()),
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
  }),

  teams: defineTable({
    teamName: v.string(),
    teamDescription: v.string(),
    teammates: v.array(v.id("users")),
    admins: v.optional(v.array(v.id("users"))),
    createdBy: v.id("users"),
    slug: v.string(),
    icon: v.optional(v.string()),
  }).index("bySlug", ["slug"]),
  payments: defineTable({
    userId: v.id("users"),
    organisationId: v.id("organisations"),
    totalAmount: v.float64(),
    paymentStatus: v.boolean(),
  }),
  reviews: defineTable({
    text: v.string(),
    rating: v.optional(v.float64()),
    userId: v.id("users"),
    activityId: v.id("activities"),
  }),
  quests: defineTable({
    questName: v.string(),
    expAmount: v.int64(),
    description: v.string(),
    activityId: v.id("activities"),
  }),
  reservations: defineTable({
    date: v.string(),
    time: v.string(),
    userCount: v.int64(),
    activityId: v.id("activities"),
    teamIds: v.array(v.id("teams")),
    createdBy: v.id("users"),
    readByOrganizer: v.optional(v.boolean()),
    reservationChatSlug: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
  })
    .index("byActivity", ["activityId"])
    .index("byDateTime", ["activityId", "date", "time"]),
  reservationQueue: defineTable({
    activityId: v.id("activities"),
    date: v.string(),
    teamIds: v.array(v.id("teams")),
    userCount: v.int64(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    notifiedAt: v.optional(v.number()),
  })
    .index("byActivityDate", ["activityId", "date"]),
  conversations: defineTable({
    user1Id: v.id("users"),
    user2Id: v.id("users"),
    slug: v.string(),
    createdAt: v.number(),
  })
    .index("bySlug", ["slug"])
    .index("byUser1", ["user1Id"])
    .index("byUser2", ["user2Id"]),
  messages: defineTable({
    text: v.string(),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    timestamp: v.number(),
    readBy: v.optional(v.array(v.id("users"))),
    encrypted: v.optional(v.boolean()),
  })
    .index("byConversation", ["senderId", "receiverId"])
    .index("byReceiver", ["receiverId"]),
  groupMessages: defineTable({
    text: v.string(),
    senderId: v.id("users"),
    teamId: v.id("teams"),
    timestamp: v.number(),
    readBy: v.optional(v.array(v.id("users"))),
    encrypted: v.optional(v.boolean()),
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
  }),
});
