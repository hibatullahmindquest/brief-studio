import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminError } from "./errors";

// Admin assignment for Users (Teams). Pure data layer: only the three assignment
// fields are touchable here — password/email/username/name are never written, so an
// admin can reassign roles without being able to hijack credentials. The last-admin
// guard lives here so both the API route and the tsx verify script share it.

export const TEAM_ROLES = ["marketing", "creative"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

// lens scope: "single" member | "multi" (HOD) | "all" (admin)
export const TEAMS = ["single", "multi", "all"] as const;
export type Team = (typeof TEAMS)[number];

export type UserAssignmentInput = {
  teamRole?: string;
  team?: string;
  isAdmin?: boolean;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  teamRole: string;
  team: string;
  isAdmin: boolean;
};

// Only safe, assignment-relevant columns leave this layer — never password/username.
export function listUsers(): Promise<UserRow[]> {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, teamRole: true, team: true, isAdmin: true },
    orderBy: { name: "asc" },
  });
}

export async function updateUser(id: string, input: UserAssignmentInput): Promise<UserRow> {
  if (!id) throw new AdminError(400, "id is required");

  const data: Prisma.UserUpdateInput = {};
  if (input.teamRole !== undefined) {
    if (!TEAM_ROLES.includes(input.teamRole as TeamRole)) {
      throw new AdminError(400, `Invalid teamRole: ${input.teamRole}`);
    }
    data.teamRole = input.teamRole;
  }
  if (input.team !== undefined) {
    if (!TEAMS.includes(input.team as Team)) {
      throw new AdminError(400, `Invalid team: ${input.team}`);
    }
    data.team = input.team;
  }

  if (input.isAdmin !== undefined) {
    if (typeof input.isAdmin !== "boolean") throw new AdminError(400, "isAdmin must be a boolean");
    // Last-admin guard: block a change that would leave the system with zero admins.
    if (input.isAdmin === false) {
      const target = await prisma.user.findUnique({ where: { id }, select: { isAdmin: true } });
      if (!target) throw new AdminError(404, "user not found");
      if (target.isAdmin) {
        const adminCount = await prisma.user.count({ where: { isAdmin: true } });
        if (adminCount <= 1) {
          throw new AdminError(409, "Cannot demote the last admin — grant admin to another user first");
        }
      }
    }
    data.isAdmin = input.isAdmin;
  }

  try {
    return await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, teamRole: true, team: true, isAdmin: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new AdminError(404, "user not found");
    }
    throw e;
  }
}
