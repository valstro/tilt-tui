import {
  UpdateStatus,
  RuntimeStatus,
  APIResource,
  APIResourceStatus,
} from "./api-types";
import { Resource, ResourceDisableState, ResourceStatus } from "./types";

export function resourceIsDisabled(resource: APIResource | undefined): boolean {
  if (!resource) {
    return false;
  }

  // Consider both "pending" and "disabled" states as disabled resources
  const disableState = resource.status?.disableStatus?.state;
  if (
    disableState === ResourceDisableState.Pending ||
    disableState === ResourceDisableState.Disabled
  ) {
    return true;
  }

  return false;
}

export function buildStatus(r: APIResource): ResourceStatus {
  let res: APIResourceStatus = r.status || {};

  if (resourceIsDisabled(r)) {
    return ResourceStatus.Disabled;
  } else if (res.updateStatus == UpdateStatus.InProgress) {
    return ResourceStatus.Building;
  } else if (res.updateStatus == UpdateStatus.Pending) {
    return ResourceStatus.Pending;
  } else if (
    res.updateStatus == UpdateStatus.NotApplicable ||
    res.updateStatus == UpdateStatus.None
  ) {
    return ResourceStatus.None;
  } else if (res.updateStatus == UpdateStatus.Error) {
    return ResourceStatus.Unhealthy;
  } else if (res.updateStatus == UpdateStatus.Ok) {
    return ResourceStatus.Healthy;
  }
  return ResourceStatus.None;
}

export function runtimeStatus(r: APIResource): ResourceStatus {
  let res: APIResourceStatus = r.status || {};

  // Regardless of warning logs, check if a resource
  // is disabled to return a disabled status
  if (resourceIsDisabled(r)) {
    return ResourceStatus.Disabled;
  }

  switch (res.runtimeStatus) {
    case RuntimeStatus.Error:
      return ResourceStatus.Unhealthy;
    case RuntimeStatus.Pending:
      return ResourceStatus.Pending;
    case RuntimeStatus.Ok:
      return ResourceStatus.Healthy;
    case RuntimeStatus.NotApplicable:
    case RuntimeStatus.None:
      return ResourceStatus.None;
  }
  return ResourceStatus.None;
}

export function getEffectiveStatus(resource: Resource): ResourceStatus {
  if (
    resource.runtimeStatus === ResourceStatus.Unhealthy ||
    resource.updateStatus === ResourceStatus.Unhealthy
  ) {
    return ResourceStatus.Unhealthy;
  }

  if (
    resource.runtimeStatus === ResourceStatus.Building ||
    resource.updateStatus === ResourceStatus.Building
  ) {
    return ResourceStatus.Building;
  }

  if (
    resource.runtimeStatus === ResourceStatus.Pending ||
    resource.updateStatus === ResourceStatus.Pending
  ) {
    return ResourceStatus.Pending;
  }

  if (
    resource.runtimeStatus === ResourceStatus.Healthy ||
    resource.updateStatus === ResourceStatus.Healthy
  ) {
    return ResourceStatus.Healthy;
  }

  return ResourceStatus.None;
}
