import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    name: v.string(),
    lastname: v.string(),
    username: v.string(),
    email: v.string(),
    avatar: v.string(),
  }).index('byExternalId', ['externalId']),
});
