import { getUsers } from "@/server/actions/user";
import { getEmployeeOptions } from "@/server/actions/employee";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const [users, employees] = await Promise.all([
    getUsers(),
    getEmployeeOptions(),
  ]);

  return <UsersClient users={users} employees={employees} />;
}
