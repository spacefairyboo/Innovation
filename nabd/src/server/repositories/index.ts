/* Data-access facade — the read/write API the route layer consumes.
   Repositories own the SQL; the access service owns visibility rules.
   Import from here in pages and actions; import concrete modules only
   inside the server layer itself. */

export * from "./orgRepository";
export * from "./projectRepository";
export * from "./taskRepository";
export {
  scopeTasks, sectionTasks, overseesTeam, canUpdateTask,
  buildNotifications, unreadCount, markAllRead,
} from "../services/accessService";
