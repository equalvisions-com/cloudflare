import { IconHeart, IconMessageCircle, IconRepeat, IconShare3, IconDots } from '@tabler/icons-react';

export const LikeIcon = ({ className = "", ...props }) => (
  <IconHeart className={`text-muted-foreground ${className}`} strokeWidth={2.5} {...props} />
);

export const CommentIcon = ({ className = "", ...props }) => (
  <IconMessageCircle className={`text-muted-foreground ${className}`} strokeWidth={2.5} {...props} />
);

export const RetweetIcon = ({ className = "", ...props }) => (
  <IconRepeat className={`text-muted-foreground ${className}`} strokeWidth={2.5} {...props} />
);

export const ShareIcon = ({ className = "", ...props }) => (
  <IconShare3 className={`text-muted-foreground ${className}`} strokeWidth={2.5} {...props} />
);

export const DotsIcon = ({ className = "", ...props }) => (
  <IconDots className={`text-muted-foreground ${className}`} strokeWidth={2.5} {...props} />
); 