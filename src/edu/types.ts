export type EduRole = 'superadmin' | 'teacher' | 'parent' | 'child'

export type EduContentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

export interface EduUser {
  id: string
  name: string
  role: EduRole
  assignedChildIds: string[]
}

export interface EduContentItem {
  id: string
  title: string
  body: string
  ageGroup: string
  difficulty: 'easy' | 'medium' | 'hard'
  sensitiveTopics: boolean
  status: EduContentStatus
  createdBy: string
  reviewNotes?: string
  createdAt: string
  reviewedAt?: string
}

export interface ParentControls {
  childId: string
  parentId: string
  allowedStart: string
  allowedEnd: string
  maxDailyUsageMinutes: number
  breakReminderIntervalMinutes: number
  disabledModules: string[]
  pauseAccessNow: boolean
  updatedAt: string
}

export type SafetyEventType =
  | 'restricted_page_attempt'
  | 'content_rejected'
  | 'parent_pause_toggled'
  | 'help_requested'
  | 'overload_alert_triggered'

export interface SafetyEvent {
  id: string
  type: SafetyEventType
  actorUserId: string
  childId?: string
  message: string
  createdAt: string
}

export interface EduAlert {
  id: string
  childId: string
  source: 'system' | 'child' | 'teacher' | 'parent'
  severity: 'low' | 'medium' | 'high'
  message: string
  status: 'open' | 'resolved'
  createdAt: string
}

export interface ChildLockState {
  locked: boolean
  reason?: string
}
