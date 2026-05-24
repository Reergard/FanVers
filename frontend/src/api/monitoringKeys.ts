/** Query keys для React Query — моніторинг читання */

export const monitoringKeys = {
  readingStats: () => ["reading-stats"] as const,
  chapterProgress: (chapterId: number) =>
    ["chapter-progress", chapterId] as const,
};
