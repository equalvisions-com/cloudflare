// ADDITIONAL FUNCTION: searchUsers
/** @convex public */
export async function searchUsers({ db }: { db: any }, { searchQuery }: { searchQuery: string }) {
  // Perform a simple case-insensitive search on the 'users' collection based on the provided searchQuery
  const users = await db.query("users")
    .filter((user: any) => user.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .limit(10)
    .collect();
  return { users };
}

// ADDITIONAL FUNCTION: searchUsersOptimized
/** @convex public */
export async function searchUsersOptimized(
  { db }: { db: any },
  { query, cursor, limit }: { query: string, cursor?: string, limit: number }
) {
  let dbQuery = db.query("users")
    .filter((user: any) => user.name.toLowerCase().includes(query.toLowerCase()));
  
  if (cursor) {
    dbQuery = dbQuery.filter((user: any) => user._id > cursor);
  }
  
  const results = await dbQuery.limit(limit + 1).collect();
  let hasMore = false;
  let nextCursor: string | null = null;
  
  if (results.length > limit) {
    hasMore = true;
    const extra = results.pop();
    nextCursor = extra._id;
  }
  
  const users = results.map((user: any) => ({
    userId: user._id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    profileImage: user.profileImage,
    isAuthenticated: user.isAuthenticated,
    friendshipStatus: user.friendshipStatus
  }));
  
  return { users, nextCursor, hasMore };
}

// ADDITIONAL FUNCTION: getRandomUsersOptimized
/** @convex public */
export async function getRandomUsersOptimized({ db }: { db: any }, { limit }: { limit: number }) {
  const users = await db.query("users")
    .limit(limit)
    .collect();

  const mapped = users.map((user: any) => ({
    userId: user._id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    profileImage: user.profileImage,
    isAuthenticated: user.isAuthenticated,
    friendshipStatus: user.friendshipStatus
  }));

  return { users: mapped };
} 