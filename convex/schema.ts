import { Organization } from '@clerk/backend';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    name: v.string(),
    lastname: v.string(),
    username: v.string(),
    description: v.string(),
    email: v.string(),
    contact: v.string(),
    avatar: v.string(),
    totalExp: v.int64(),
    friends: v.array(v.id("users")),

  }).index('byExternalId', ['externalId']),
  
  
  organizers: defineTable({
    userId: v.id("users"),
    organizationId: v.string(),
  }),


  organizations: defineTable({
    organizationName: v.string(),
    organizationEmail: v.string(),
    address: v.string(),
    longitude: v.float64(),
    latitude: v.float64(),
    description: v.string(),
    IBAN: v.string(),
    organizerIDs: v.array(v.id("organizers")),
  }),

  team: defineTable({
    teamName: v.string(),
    teamDescription: v.string(),
    teammates: v.array(v.id("users")),
  }),
  payments: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    totalAmount: v.float64(),
    paymentStatus: v.boolean(),

  }),
  reviews: defineTable({
    text: v.string(),
    rating: v.float64(),
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
    userCount: v.int64(),
    activityId: v.id("activities"),
    teamIds: v.array(v.id("teams")),

  }),
  messages: defineTable({
    text: v.string(),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    teamId: v.id("teams"),

  }),
  activities: defineTable({
    activityName: v.string(),
    description: v.string(),
    address: v.string(),
    longitude: v.float64(),
    latitude: v.float64(),
  }),

});
