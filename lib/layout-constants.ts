/**
 * Shared layout constants to ensure consistency across different page layouts
 */
export const LAYOUT_CONSTANTS = {
  // Container classes - ensure flex layout for horizontal arrangement
  CONTAINER_CLASS: "container mx-auto min-h-[100dvh] flex flex-col md:flex-row gap-6 p-0 md:px-6",
  
  // Content area classes
  MAIN_CONTENT_CLASS: "flex-1 md:basis-[50%] md:max-w-[50%] border-l border-r",
  MAIN_CONTENT_WITH_CARD_STYLE: "flex-1 md:basis-[50%] md:max-w-[50%] border-l border-r",
  
  // Sidebar classes
  RIGHT_SIDEBAR_CLASS: "hidden md:block md:basis-[25%] md:max-w-[25%] shrink-0",
  LEFT_SIDEBAR_WRAPPER_CLASS: "hidden md:block md:basis-[25%] md:max-w-[25%] shrink-[3]",
  
  // Spacing
  CONTENT_TOP_MARGIN: "mt-6"
}; 