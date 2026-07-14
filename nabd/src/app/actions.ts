/* The application's mutation API — a stable facade over the action layer.
   Client components import from here; implementations live in
   src/server/actions/* (controllers, each marked "use server"), which delegate to services and
   repositories. Every action re-validates the session server-side. */

export {
  applyCheckin, applyTaskEdit, createTaskFromChat, quickDone, removeTask,
  saveTask, saveTaskChecklist,
} from "@/server/actions/taskActions";
export { addSuggestedTask, dismissSuggestion } from "@/server/actions/inboxActions";
export {
  delegateTaskAction, endDelegationAction, endTaskDelegationAction,
  startDelegationAction,
} from "@/server/actions/delegationActions";
export { savePreferences, setLang, setTheme, switchUser } from "@/server/actions/profileActions";
export { emailMyBriefing, markNotificationsRead, resetDemo } from "@/server/actions/systemActions";
export { loginAction, logoutAction } from "@/server/actions/authActions";
export { askAssistant } from "@/server/actions/assistantActions";
