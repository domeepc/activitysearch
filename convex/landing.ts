import { query } from "./_generated/server";

/**
 * Real data for the public landing page: best-rated activities, active quests and recent reviews.
 * Public (no sign-in), so it returns only what's already public: listing basics, quest names,
 * review text with the reviewer's first name and last initial.
 */
// shortcut: reads every activity, review and quest; fine while the landing page re-fetches hourly, add a ratings summary table past ~10k reviews
export const showcase = query({
  args: {},
  handler: async (ctx) => {
    const [activities, reviews, quests] = await Promise.all([
      ctx.db.query("activities").collect(),
      ctx.db.query("reviews").collect(),
      ctx.db.query("quests").collect(),
    ]);

    const ratings = new Map<string, { sum: number; count: number }>();
    for (const review of reviews) {
      if (review.rating === undefined) continue;
      const entry = ratings.get(review.activityId) ?? { sum: 0, count: 0 };
      entry.sum += review.rating;
      entry.count += 1;
      ratings.set(review.activityId, entry);
    }
    const average = (id: string) => {
      const r = ratings.get(id);
      return r ? r.sum / r.count : 0;
    };

    // Rated activities first (best average, then most reviews); newest unrated ones fill the rest
    const topActivities = [...activities]
      .sort(
        (a, b) =>
          average(b._id) - average(a._id) ||
          (ratings.get(b._id)?.count ?? 0) - (ratings.get(a._id)?.count ?? 0) ||
          b._creationTime - a._creationTime
      )
      .slice(0, 4)
      .map((a) => ({
        id: a._id,
        title: a.activityName,
        category: a.tags[0] ?? a.difficulty,
        price: `€${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}`,
        rating: ratings.has(a._id) ? average(a._id).toFixed(1) : "New",
        imageUrl: a.images?.[0],
      }));

    const activeQuests = quests
      .filter((q) => q.isActive !== false)
      .sort((a, b) => (a.questType === b.questType ? (a.sortOrder ?? 0) - (b.sortOrder ?? 0) : a.questType === "system" ? -1 : 1))
      .slice(0, 4)
      .map((q) => ({ title: q.questName, subtitle: q.description, badge: `+${Number(q.expAmount)} XP` }));

    const activityName = new Map(activities.map((a) => [a._id as string, a.activityName]));
    const recentReviews = await Promise.all(
      reviews
        .filter((r) => r.text.trim().length >= 20 && (r.rating ?? 5) >= 4)
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 3)
        .map(async (r) => {
          const user = await ctx.db.get(r.userId);
          return {
            id: r._id,
            text: r.text,
            rating: r.rating ?? null,
            author: user ? `${user.name} ${user.lastname ? `${user.lastname[0]}.` : ""}`.trim() : "Former guest",
            avatar: user?.avatar ?? "",
            activityName: activityName.get(r.activityId) ?? "",
          };
        })
    );

    return { topActivities, quests: activeQuests, reviews: recentReviews };
  },
});
