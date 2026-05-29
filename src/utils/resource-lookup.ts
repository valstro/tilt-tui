import type { Resource } from "@/tilt/types";

export function findResourceByName(
  resources: Resource[],
  name: string,
): Resource | undefined {
  return resources.find((r) => r.name === name);
}
