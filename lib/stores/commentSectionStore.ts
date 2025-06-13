import { create } from 'zustand';
import { 
  CommentSectionStore, 
  CommentSectionState, 
  CommentFromAPI 
} from '@/lib/types';
import { Id } from '@/convex/_generated/dataModel';

// Initial state factory
const createInitialState = (): CommentSectionState => ({
  // UI State
  isOpen: false,
  comment: '',
  isSubmitting: false,
  replyToComment: null,
  expandedReplies: new Set<string>(),
  deletedComments: new Set<string>(),
  
  // Optimistic Updates
  optimisticCount: null,
  optimisticTimestamp: null,
  
  // Metrics
  metricsLoaded: false,
});

// Store factory function following established patterns
export const createCommentSectionStore = () => create<CommentSectionStore>((set, get) => ({
  // Initial state
  ...createInitialState(),

  // UI Actions
  setIsOpen: (open: boolean) => {
    set({ isOpen: open });
  },

  setComment: (comment: string) => {
    set({ comment: comment.slice(0, 500) }); // Enforce 500 char limit
  },

  setIsSubmitting: (submitting: boolean) => {
    set({ isSubmitting: submitting });
  },

  setReplyToComment: (comment: CommentFromAPI | null) => {
    set({ replyToComment: comment });
  },

  toggleRepliesVisibility: (commentId: string) => {
    set((state) => {
      const newExpandedReplies = new Set(state.expandedReplies);
      if (newExpandedReplies.has(commentId)) {
        newExpandedReplies.delete(commentId);
      } else {
        newExpandedReplies.add(commentId);
      }
      return { expandedReplies: newExpandedReplies };
    });
  },

  addDeletedComment: (commentId: string) => {
    set((state) => {
      const newDeletedComments = new Set(state.deletedComments);
      newDeletedComments.add(commentId);
      return { deletedComments: newDeletedComments };
    });
  },

  // Comment Actions (these will be implemented in the hook)
  submitComment: async () => {
    // Implementation will be in the custom hook
    console.log('submitComment called - implementation in hook');
  },

  deleteComment: async (commentId: Id<"comments">) => {
    // Implementation will be in the custom hook
    console.log('deleteComment called - implementation in hook', commentId);
  },

  // Optimistic Updates
  setOptimisticCount: (count: number | null) => {
    set({ optimisticCount: count });
  },

  setOptimisticTimestamp: (timestamp: number | null) => {
    set({ optimisticTimestamp: timestamp });
  },

  // Metrics
  setMetricsLoaded: (loaded: boolean) => {
    set({ metricsLoaded: loaded });
  },

  // Utility
  reset: () => {
    set(createInitialState());
  },
})); 