export type Role = "admin" | "teacher";
export type Mode = "in_person" | "online";
export type LessonStatus = "scheduled" | "completed" | "cancelled";
export type Channel = "referral" | "direct" | "other";
export const DASHBOARD_TABS = ["Raspored", "Učenici", "Obračun", "Poruke"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export interface Employee {
  id: string;
  name: string;
  email: string;
  contactEmail?: string;
  preferences?: { notifications: boolean; sound: boolean };
  role: Role;
  color: string;
  canSetPrice: boolean;
  canScheduleOthers?: boolean;
  allowedTabs?: string[];
  historyWeeksSelf?: number | null;
  historyWeeksOthers?: number | null;
  active: boolean;
}
export interface Student {
  id: string;
  name: string;
  level: string;
  university?: boolean;
  subject: string;
  channel: Channel;
  ownerIds: string[];
  packageSize?: number;
  referralNote?: string;
  otherNote?: string;
  notes?: string;
  createdAt?: string;
}
export interface Lesson {
  id: string;
  studentId: string;
  teacherId: string;
  date: string;
  start: number;
  duration: number;
  units?: number;
  cycleNumbers?: number[];
  cycleSize?: number;
  sourceCounter?: { numbers: number[]; size: number };
  counterOverride?: {
    numbers: number[];
    size: number;
    propagate: boolean;
    follow?: boolean;
    baseline?: { numbers: number[]; size: number };
  };
  deletedAt?: string;
  desk: 1 | 2 | null;
  mode: Mode;
  topic: string;
  status: LessonStatus;
  price: number | null;
  bossBps: number | null;
  priceManual?: boolean;
  bossManual?: boolean;
  university?: boolean;
  referral?: boolean;
  ruleId: string | null;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
  sourceId?: string;
  importedDuration?: { original: number; rounded: number };
  localOverride?: boolean;
  sourceMissing?: boolean;
  conflict?: string;
}
export interface RateRule {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  teacherId: string | null;
  duration: number | null;
  mode: Mode | null;
  level: string | null;
  channel: Channel | null;
  price: number;
  bossBps: number;
}
export interface Payment {
  id: string;
  lessonId: string;
  amount: number;
  date: string;
  note: string;
  actorId: string;
  voidedAt?: string;
}
export interface Handover {
  id: string;
  lessonId: string;
  teacherId: string;
  amount: number;
  date: string;
  confirmed: boolean;
  confirmedBy: string | null;
  actorId: string;
  voidedAt?: string;
}
export interface Attachment {
  id: string;
  lessonId: string;
  studentId: string;
  name: string;
  mime: string;
  size: number;
  key: string;
  kind: "material" | "proof";
  sentAt: string | null;
  uploadedBy: string;
  createdAt: string;
}
export interface CounterEvent {
  id: string;
  studentId: string;
  type: "completed" | "increment" | "reset" | "set";
  value?: number;
  size?: number;
  lessonId: string | null;
  actorId: string;
  at: string;
}
export interface Audit {
  id: string;
  actorId: string;
  action: string;
  entityId: string;
  at: string;
  before: unknown;
  after: unknown;
}
export interface SourceBlock {
  id: string;
  sheetId: number;
  range: string;
  date: string;
  start: number;
  duration: number;
  desk: 1 | 2;
  color: string;
  text: string;
  studentName?: string;
  sourceCounter?: { numbers: number[]; size: number };
  teacherId?: string;
  studentId?: string;
  issue?: string;
  missing?: boolean;
}
export interface SyncSettings {
  spreadsheetId: string;
  roundDurations?: boolean;
  firstYear: number;
  colorMap: Record<string, string>;
  studentMap: Record<string, string>;
  lastSuccess: string | null;
  lastAttempt?: string;
  lastError: string | null;
  watchId?: string;
  watchToken?: string;
  resourceId?: string;
  watchExpires?: number;
}
export interface SchoolState {
  revision: number;
  defaultsVersion?: number;
  sampleDataCleanupVersion?: number;
  pricingVersion?: number;
  financeConfirmationVersion?: number;
  employees: Employee[];
  students: Student[];
  lessons: Lesson[];
  rules: RateRule[];
  payments: Payment[];
  handovers: Handover[];
  attachments: Attachment[];
  counters: CounterEvent[];
  audits: Audit[];
  sourceBlocks: SourceBlock[];
  sync: SyncSettings;
  // Server-only encrypted OAuth credential. Never included in SchoolView or undo.
  googleConnection?: {
    id: string;
    spreadsheetId: string;
    clientId: string;
    email: string;
    sealedRefreshToken: string;
    connectedAt: string;
    actorId: string;
  };
  googleSyncLease?: { id: string; expires: number };
  operations?: { key: string; actorId: string; hash: string }[];
  undoEntries?: UndoEntry[];
  messages?: StaffMessage[];
  boardResetBackup?: {
    id: string;
    at: string;
    actorId: string;
    data: Pick<
      SchoolState,
      | "students"
      | "lessons"
      | "payments"
      | "handovers"
      | "counters"
      | "messages"
      | "audits"
      | "undoEntries"
      | "attachments"
      | "sourceBlocks"
    > & { studentMap: Record<string, string> };
  };
}
export type CounterScope = "only" | "future" | "previous";
export interface StaffMessage {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  replyTo?: string;
  likedBy: string[];
  pinned: boolean;
}
export interface UndoEntry {
  id: string;
  actorId: string;
  label: string;
  undone: boolean;
  redoable?: boolean;
  reverted?: { collection: string; id: string; value: unknown }[];
  changes: {
    collection: string;
    id: string;
    before: unknown;
    after: unknown;
    beforeIndex?: number;
  }[];
}
export interface BusyLesson {
  id: string;
  studentName?: string;
  teacherId: string;
  date: string;
  start: number;
  duration: number;
  desk: 1 | 2 | null;
  mode: Mode;
  restricted: true;
}
export interface LessonPreview {
  id?: string;
  studentId?: string;
  studentName: string;
  teacherId: string;
  date: string;
  start: number;
  duration: number;
  units: number;
  desk: 1 | 2 | null;
  mode: Mode;
  error?: string;
}
export type DraftMove = Pick<
  LessonPreview,
  "date" | "start" | "duration" | "desk" | "mode"
>;
export interface DraftMoveUpdate {
  serial: number;
  patch: DraftMove;
}
export interface StudentView extends Student {
  total: number;
  cycle: number;
  cycleSize?: number;
}
export interface SchoolView {
  revision: number;
  roundImportedDurations?: boolean;
  actor: Employee;
  employees: Employee[];
  students: StudentView[];
  lessons: (Lesson | BusyLesson)[];
  financeLessons?: (Lesson & { studentName: string })[];
  rules: RateRule[];
  payments: Payment[];
  handovers: Handover[];
  attachments: Attachment[];
  audits: Audit[];
  sourceBlocks: SourceBlock[];
  sync: Omit<SyncSettings, "watchToken"> | null;
  demo: boolean;
  undoLabel?: string | null;
  redoLabel?: string | null;
  messages: StaffMessage[];
}
