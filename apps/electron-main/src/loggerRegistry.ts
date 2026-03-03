import { ActivityLogger } from './activityLogger'

const loggerCache = new Map<string, ActivityLogger>()

export function getActivityLogger(projectRoot: string): ActivityLogger {
  if (!loggerCache.has(projectRoot)) {
    loggerCache.set(projectRoot, new ActivityLogger(projectRoot))
  }
  return loggerCache.get(projectRoot)!
}
