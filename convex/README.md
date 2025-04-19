# Welcome to your Convex functions directory!

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// functions.js
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query("tablename").collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.functions.myQueryFunction, {
  first: 10,
  second: "hello",
});
```

A mutation function looks like:

```ts
// functions.js
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert("messages", message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get(id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.functions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: "Hello!", second: "me" });
  // OR
  // use the result once the mutation has completed
  mutation({ first: "Hello!", second: "me" }).then((result) =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.

## Query Optimization Guidelines

When writing Convex queries, it's important to optimize database access to:
1. Improve performance 
2. Reduce bandwidth usage
3. Prevent exposing sensitive user information

### Best Practices

#### 1. Return Minimal Data Sets
```ts
// DON'T: Return entire user document
const user = await ctx.db.get(userId);
return user;

// DO: Return only required fields
const user = await ctx.db.get(userId);
return {
  id: user._id,
  username: user.username,
  name: user.name,
  // Only include fields needed by the client
};
```

#### 2. Selective Batch Queries
When loading many documents, use batch queries with explicit field selection:
```ts
// For multiple documents, batch and select specific fields
const users = await Promise.all(
  userIds.map(id => 
    ctx.db.get(id).then(user => 
      user ? {
        _id: user._id,
        username: user.username,
        name: user.name
      } : null
    )
  )
);
```

#### 3. Optimize Helper Functions
For reused query patterns:
```ts
// Create optimized helpers that only fetch needed fields
async function getUserBasicInfo(ctx, userId) {
  const user = await ctx.db.get(userId);
  return user ? {
    userId: user._id,
    username: user.username,
    name: user.name
  } : null;
}
```

#### 4. Use Field Selection Parameters
Allow callers to specify exactly which fields they need:
```ts
export const getUserData = query({
  args: { 
    userId: v.id("users"),
    fields: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { userId, fields = ["username", "name"] } = args;
    
    const user = await ctx.db.get(userId);
    if (!user) return null;
    
    // Only return requested fields
    const result = { userId: user._id };
    fields.forEach(field => {
      if (field in user) {
        result[field] = user[field];
      }
    });
    
    return result;
  }
});
```

#### 5. Lookup Tables for Relationships
For data that requires checking relationships:
```ts
// Create lookup maps for fast relationship checks
const userMap = new Map();
users.forEach(user => {
  userMap.set(user._id.toString(), {
    username: user.username,
    name: user.name
  });
});

// Later use the map instead of additional queries
const userData = userMap.get(userId.toString());
```

By following these patterns, we can ensure that our application remains performant while maintaining data security.
