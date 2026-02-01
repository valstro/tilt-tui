// Tilt API Types - TypeScript translation from Go

// UIButton annotation constants
export const UIBUTTON_ANNOTATION_TYPE = "tilt.dev/uibutton-type";
export const UIBUTTON_TOGGLE_DISABLE_TYPE = "DisableToggle";

export interface TiltApiResourceMetadata {
  annotations: Record<string, string>;
  creationTimestamp: string;
  labels: Record<string, string>;
  name: string;
  resourceVersion: string;
  uid: string;
}

export interface TiltApiUIResource {
  apiVersion: string;
  kind: string;
  metadata: TiltApiResourceMetadata;
  spec: Record<string, unknown>;
  status: TiltResourceStatus;
}

export interface TiltBuild {
  startTime?: string;
  finishTime?: string;
  error?: string;
  warnings?: string[];
  edits?: string[];
  reason?: string;
  spanID?: string;
}

export interface TiltStatusSpec {
  id: string;
  type: string; // "local" | "k8s" | "image"
}

export interface TiltStatusCondition {
  lastTransitionTime: string;
  reason: string;
  status: string; // "True" | "False" | "Unknown"
  type: string; // "UpToDate" | "Ready"
}

export interface TiltDisableStatus {
  disabledCount: number;
  enabledCount: number;
  sources: unknown;
  state: unknown;
}

export interface TiltK8sResourceStatusInfo {
  allContainersReady: boolean;
  displayNames: string[];
  podCreationTime: string;
  podName: string;
  podRestarts: number;
  podStatus: string;
  podUpdateStartTime?: string;
  spanID: string;
}

export interface TiltLocalResourceInfo {
  pid?: string;
}

export interface TiltEndpointLink {
  url: string;
  name?: string;
}

export interface TiltResourceStatus {
  // Common fields
  order: number;
  conditions: TiltStatusCondition[];
  disableStatus: TiltDisableStatus;
  pendingBuildSince?: string;
  runtimeStatus?: string; // "ok" | "error" | "pending" | "not_applicable"
  updateStatus?: string; // "ok" | "error" | "pending" | "not_applicable" | "none"

  // Build-related fields
  buildHistory?: TiltBuild[];
  lastDeployTime?: string;

  // Endpoint links
  endpointLinks?: TiltEndpointLink[];

  // K8s-specific fields
  k8sResourceInfo?: TiltK8sResourceStatusInfo;
  specs?: TiltStatusSpec[];

  // Local-specific fields
  localResourceInfo?: TiltLocalResourceInfo;
  triggerMode?: number;
}

export interface LogSegment {
  spanId: string;
  time: string;
  text: string;
  level: string;
}

export interface SpanSet {
  manifestName: string;
}

export interface LogList {
  segments: LogSegment[];
  spans: Record<string, SpanSet | null>;
  fromCheckpoint: number;
  toCheckpoint: number;
}

export interface UIButtonSpec {
  location?: {
    componentID: string;
    componentType: string;
  };
  text: string;
  iconName?: string;
  iconSVG?: string;
  disabled?: boolean;
  requiresConfirmation?: boolean;
  inputs?: UIInputSpec[];
}

export interface UIInputSpec {
  name: string;
  label?: string;
  text?: { defaultValue?: string; placeholder?: string };
  bool?: { defaultValue?: boolean; trueString?: string; falseString?: string };
  hidden?: { value?: string };
  choice?: { choices?: string[] };
}

export interface UIButtonStatus {
  lastClickedAt?: string;
  inputs?: UIInputStatus[];
}

export interface UIInputStatus {
  name: string;
  text?: { value: string };
  bool?: { value: boolean };
  hidden?: { value: string };
  choice?: { value: string };
}

export interface UIButton {
  metadata: TiltApiResourceMetadata;
  spec: UIButtonSpec;
  status: UIButtonStatus;
}

export interface UISession {
  metadata: TiltApiResourceMetadata;
  status: {
    tiltStartTime: string; // "2026-02-01T03:54:47.382191Z"
    tiltfileKey: string; // "/Users/ac/workspace/andycmaj/tilt/tilt-demo-app/Tiltfile"
  };
}

export interface ViewResponse {
  tiltStartTime: string; // "2026-02-01T03:54:47.382191Z"
  uiSession?: UISession;
  uiResources?: TiltApiUIResource[];
  uiButtons?: UIButton[];
  logList?: LogList;
  isComplete: boolean;
}

// Processed types for UI display

export interface LogEntry {
  timestamp: Date;
  spanId: string;
  level: string;
  text: string;
  source: string;
}

export interface EndpointLink {
  name: string;
  url: string;
}

export interface ButtonAction {
  name: string;
  text: string;
  resourceName: string;
  disabled: boolean;
  inputs: UIInputSpec[];
  /** Raw UIButton for API calls - includes metadata.resourceVersion */
  raw: UIButton;
}

export interface Resource {
  name: string;
  type: string;
  runtimeStatus: string;
  updateStatus: string;
  lastDeployAt: string;
  buildError: string;
  podStatus: string;
  podName: string;
  endpoints: EndpointLink[];
  isDisabled: boolean;
  hasPending: boolean;
  order: number;
  buttons: ButtonAction[];
  /** The disable toggle button for this resource (if it exists) */
  disableToggleButton?: UIButton;
  raw: TiltApiUIResource;
}

// Helper functions

export function isTiltfile(status: TiltResourceStatus): boolean {
  return status.order === 1;
}

export function isK8sResource(status: TiltResourceStatus): boolean {
  return !!status.k8sResourceInfo;
}

export function isLocalResource(status: TiltResourceStatus): boolean {
  return !!status.localResourceInfo;
}

export function getResourceType(status: TiltResourceStatus): string {
  for (const spec of status.specs ?? []) {
    if (spec.type) return spec.type;
  }
  if (isTiltfile(status)) return "tiltfile";
  return "";
}

export function isDisabled(status: TiltResourceStatus): boolean {
  if (!status.disableStatus) return false;
  // enabledCount may be undefined when disabled, so check disabledCount > 0 and enabledCount is falsy
  return (
    status.disableStatus.disabledCount > 0 && !status.disableStatus.enabledCount
  );
}

export function hasPendingChanges(status: TiltResourceStatus): boolean {
  return !!status.pendingBuildSince && status.pendingBuildSince !== "";
}

export function getLastBuildError(status: TiltResourceStatus): string {
  if (
    status.buildHistory &&
    status.buildHistory.length > 0 &&
    status.buildHistory[0].error
  ) {
    return status.buildHistory[0].error;
  }
  return "";
}

export function resourceFromAPIResource(uir: TiltApiUIResource): Resource {
  const resource: Resource = {
    name: uir.metadata.name,
    runtimeStatus: uir.status.runtimeStatus ?? "not_applicable",
    updateStatus: uir.status.updateStatus ?? "not_applicable",
    type: getResourceType(uir.status),
    isDisabled: isDisabled(uir.status),
    hasPending: hasPendingChanges(uir.status),
    buildError: getLastBuildError(uir.status),
    order: uir.status.order,
    lastDeployAt: uir.status.lastDeployTime ?? "",
    podStatus: "",
    podName: "",
    endpoints: [],
    buttons: [],
    raw: uir,
  };

  // Get endpoint links
  for (const link of uir.status.endpointLinks ?? []) {
    resource.endpoints.push({
      name: link.name || link.url,
      url: link.url,
    });
  }

  // Get K8s-specific info
  if (uir.status.k8sResourceInfo) {
    resource.podStatus = uir.status.k8sResourceInfo.podStatus;
    resource.podName = uir.status.k8sResourceInfo.podName;
  }

  return resource;
}

export function getEffectiveStatus(resource: Resource): string {
  if (resource.runtimeStatus === "error" || resource.updateStatus === "error") {
    return "error";
  }
  if (
    resource.runtimeStatus === "pending" ||
    resource.updateStatus === "pending"
  ) {
    return "pending";
  }
  if (resource.runtimeStatus === "ok") {
    return "ok";
  }
  if (resource.updateStatus === "ok") {
    return "ok";
  }
  return "not_applicable";
}

export function buttonActionFromUIButton(btn: UIButton): ButtonAction {
  return {
    name: btn.metadata.name,
    text: btn.spec.text,
    resourceName:
      btn.spec.location?.componentType === "Resource"
        ? btn.spec.location.componentID
        : "",
    disabled: btn.spec.disabled ?? false,
    inputs: btn.spec.inputs ?? [],
    raw: btn,
  };
}

export function isDisableToggleButton(btn: UIButton): boolean {
  return (
    btn.metadata.annotations?.[UIBUTTON_ANNOTATION_TYPE] ===
    UIBUTTON_TOGGLE_DISABLE_TYPE
  );
}
