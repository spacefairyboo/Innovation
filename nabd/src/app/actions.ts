/* The application's mutation API — a stable facade over the action layer.
   Client components import from here; implementations live in
   src/server/actions/* (controllers, each marked "use server"), which delegate to services and
   repositories. Every action re-validates the session server-side. */

export {
  applyCheckin, createTaskFromChat, quickDone, removeTask,
  saveTask, saveTaskChecklist,
} from "@/server/actions/task.actions";
export { addSuggestedTask, dismissSuggestion } from "@/server/actions/inbox.actions";
export {
  delegateTaskAction, endDelegationAction, endTaskDelegationAction,
  startDelegationAction,
} from "@/server/actions/delegation.actions";
export { savePreferences, setLang, setTheme, switchUser } from "@/server/actions/profile.actions";
export { emailMyBriefing, markNotificationsRead, resetDemo } from "@/server/actions/system.actions";
