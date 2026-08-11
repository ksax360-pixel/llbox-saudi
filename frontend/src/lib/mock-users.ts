import { DEMO_USERS, createMockUser } from "@/lib/auth";
import type { User, UserRole } from "@/types";

export function buildMockUsers(): User[] {
  return (Object.keys(DEMO_USERS) as UserRole[]).flatMap((role, i) => {
    const base = createMockUser(role);
    return [
      base,
      {
        ...base,
        id: `user-${role}-2`,
        name: `${base.name.split(" ")[0]} ${["Khan", "Nasser", "Saleh", "Qureshi", "Fahad"][i]}`,
        email: `${role.replace("_", ".")}.2@llbox.com`,
        twoFactorEnabled: false,
        status: i === 4 ? "suspended" : "active",
      },
    ];
  });
}

export function findMockUser(id: string): User | undefined {
  return buildMockUsers().find((u) => u.id === id);
}
