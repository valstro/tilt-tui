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
  type: "local" | "k8s" | "image";
}

export interface TiltStatusCondition {
  lastTransitionTime: string;
  reason: string;
  status: boolean;
  type: string; // UpToDate | Ready
}

export interface TiltfileResourceStatus {
  order: 1;
  buildHistory?: TiltBuild[];
  conditions: TiltStatusCondition[];
  disableStatus: {
    disabledCount: number;
    enabledCount: number;
    sources: unknown;
    state: unknown;
  };
  lastDeployTime: string;
  pendingBuildSince: string | null;
  runtimeStatus: "not_applicable";
  updateStatus: string; // ok | none
}

export interface TiltK8sResourceStatusInfo {
  allContainersReady: boolean;
  displayNames: string[];
  podCreationTime: string;
  podName: string;
  podRestarts: number;
  podStatus: string;
  podUpdateStartTime: string | null;
  spanID: string;
}

export interface TiltK8sResourceStatus {
  buildHistory?: TiltBuild[];
  conditions: TiltStatusCondition[];
  disableStatus: {
    disabledCount: number;
    enabledCount: number;
    sources: unknown;
    state: unknown;
  };

  k8sResourceInfo?: TiltK8sResourceStatusInfo;

  lastDeployTime: string;
  order: number;
  pendingBuildSince: string | null;
  runtimeStatus: string; // ok | not_applicaable
  updateStatus: string; // ok | none

  specs: TiltStatusSpec[];
}

type BaseTiltLocalResourceStatus = {
  conditions: TiltStatusCondition[];
  disableStatus: {
    disabledCount: number;
    enabledCount: number;
    sources: unknown;
    state: unknown;
  };
  triggerMode?: number;
  order: number;
  pendingBuildSince: string | null;
  specs: TiltStatusSpec[];
};

export type TiltLocalResourceStatus = BaseTiltLocalResourceStatus &
  (
    | {
        // these don't actually need to be defined unless applicable
        // runtimeStatus: 'not_applicable' | 'none';
        // updateStatus: 'not_applicable' | 'none';
        lastDeployTime: null;
        localResourceInfo: {};
      }
    | {
        // has been run, serve_cmd
        runtimeStatus: "error" | "ok";
        updateStatus: "not_applicable";
        lastDeployTime: string;
        localResourceInfo: {
          pid: string;
        };
      }
    | {
        // has been run, cmd
        runtimeStatus: "not_applicable";
        updateStatus: "error" | "ok";
        lastDeployTime: string;
        localResourceInfo: {
          pid: string;
        };
      }
  );

export type TiltResourceStatus =
  | TiltfileResourceStatus
  | TiltK8sResourceStatus
  | TiltLocalResourceStatus;

export interface TiltApiResponse<T> {
  apiVersion: string;
  kind: string;
  items: T[];
}

export interface TiltApiResourceMetadata {
  annotations: Record<string, string>;
  creationTimestamp: string;
  labels: Record<string, string>;
  name: string;
  resourceVersion: string;
  uid: string;
}

export interface TiltApiUiResource<StatusType extends TiltResourceStatus> {
  apiVersion: string;
  kind: string;
  metadata: TiltApiResourceMetadata;
  spec: any;
  status: StatusType;
}

export type AnyTiltApiUiResource = TiltApiUiResource<TiltResourceStatus>;

export type TiltfileUiResource = TiltApiUiResource<TiltfileResourceStatus>;
export type TiltApiK8sUiResource = TiltApiUiResource<TiltK8sResourceStatus>;
export type TiltApiLocalUiResource = TiltApiUiResource<TiltLocalResourceStatus>;

export function isTiltfileUiResource(
  uiResource: AnyTiltApiUiResource,
): uiResource is TiltfileUiResource {
  return uiResource.status.order === 1;
}

export function isK8sUiResource(
  uiResource: AnyTiltApiUiResource,
): uiResource is TiltApiK8sUiResource {
  return "k8sResourceInfo" in uiResource.status;
}

export function isLocalUiResource(
  uiResource: AnyTiltApiUiResource,
): uiResource is TiltApiLocalUiResource {
  return "localResourceInfo" in uiResource.status;
}
