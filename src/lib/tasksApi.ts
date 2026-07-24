import { apiFetch } from "./api";
import { withCache, type CachedResult } from "./offlineCache";

export type TaskStatus = "todo" | "in_progress" | "done";
export type AcceptanceStatus = "pending" | "accepted" | "proposed_change";
export type TaskAction = "accept" | "propose" | "approve_proposal" | "reject_proposal";

/** Matches GET /api/admin/tasks's per-task shape exactly (camelCase). */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assignedBy: string;
  dueDate: string | null;
  status: TaskStatus;
  acceptanceStatus: AcceptanceStatus;
  proposedDueDate: string | null;
  responseMessage: string | null;
  createdAt: string;
  assigneeName: string | null;
  assigneeHasLogin: boolean;
  assignerName: string;
}

export async function listTasks(): Promise<CachedResult<Task[]>> {
  return withCache("tasks", async () => {
    const data = await apiFetch<{ tasks: Task[] }>("/api/admin/tasks");
    return data.tasks;
  });
}

/**
 * Exactly one of these three -- enforced by the type itself rather than by
 * convention, since the API only ever wants at most one of
 * assignedTo/assignToGroup in the request body.
 */
export type TaskAssignment =
  | { mode: "member"; memberId: string }
  | { mode: "group"; group: "all" | "leadership" }
  | { mode: "unassigned" };

export type CreateTaskInput = {
  title: string;
  description?: string;
  dueDate?: string;
  assignment: TaskAssignment;
};

export async function createTask(input: CreateTaskInput): Promise<{ success: true; createdCount: number }> {
  const body: {
    title: string;
    description?: string;
    dueDate?: string;
    assignedTo?: string;
    assignToGroup?: "all" | "leadership";
  } = {
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
  };

  if (input.assignment.mode === "member") {
    body.assignedTo = input.assignment.memberId;
  } else if (input.assignment.mode === "group") {
    body.assignToGroup = input.assignment.group;
  }

  return apiFetch<{ success: true; createdCount: number }>("/api/admin/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The backend detects a pure status change (allowed for the assignee even
 * without canAssignTasks) by checking every OTHER field is byte-identical
 * to the current row -- so this echoes the task's current
 * title/description/assignedTo/dueDate back unchanged alongside the new
 * status, rather than making callers remember to do that themselves.
 */
export async function updateTaskStatus(task: Task, newStatus: TaskStatus): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: task.title,
      description: task.description ?? undefined,
      assignedTo: task.assignedTo ?? undefined,
      dueDate: task.dueDate ?? undefined,
      status: newStatus,
    }),
  });
}

/**
 * Full edit -- title/description/dueDate/status/assignment, all sent
 * together (as opposed to updateTaskStatus's echo-back-everything-else-
 * unchanged status-only path). PATCH on an existing task only ever
 * supports reassigning to a single specific member (or unassigning it) --
 * the "Everyone"/"Leadership" group fan-out is a POST-only, new-task
 * concept, since a task that already exists already has one specific id.
 */
export type TaskEditAssignment = { mode: "member"; memberId: string } | { mode: "unassigned" };

export type UpdateTaskInput = {
  title: string;
  description?: string;
  dueDate?: string;
  status: TaskStatus;
  assignment: TaskEditAssignment;
};

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<{ success: true }> {
  const body: {
    title: string;
    description?: string;
    dueDate?: string;
    status: TaskStatus;
    assignedTo?: string;
  } = {
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    status: input.status,
  };

  if (input.assignment.mode === "member") {
    body.assignedTo = input.assignment.memberId;
  }

  return apiFetch<{ success: true }>(`/api/admin/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function respondToTask(
  id: string,
  action: TaskAction,
  proposedDueDate?: string,
  message?: string
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/tasks/${id}/respond`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, proposedDueDate, message }),
  });
}

export async function deleteTask(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/tasks/${id}`, { method: "DELETE" });
}
