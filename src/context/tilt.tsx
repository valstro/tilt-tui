import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  type ParentProps,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  run,
  each,
  spawn,
  sleep,
  type Task,
  type Operation,
  all,
} from "effection";
import { TiltClient } from "../tilt/client";
import {
  type Resource,
  type APIButton,
  type ButtonAction,
  buttonActionFromAPIButton,
  isDisableToggleButton,
  ResourceStatus,
} from "../tilt/types";
import { LogStore } from "../tilt/logstore";
import type { ConnectionStatus } from "../theme/theme";

export type StatusFilter =
  | "all"
  | (typeof ResourceStatus)[keyof typeof ResourceStatus];
const FILTER_ORDER: StatusFilter[] = [
  "all",
  ResourceStatus.Healthy,
  ResourceStatus.Unhealthy,
  ResourceStatus.Building,
  ResourceStatus.Pending,
];

interface TiltState {
  connectionStatus: ConnectionStatus;
  clusterContext: string;
  namespace: string;
  resources: Resource[];
  selectedResource: string | null;
  statusFilter: StatusFilter;
}

interface TiltContextValue {
  state: TiltState;
  client: TiltClient;
  logStore: LogStore;
  selectResource: (name: string) => void;
  triggerResource: (name: string) => Promise<void>;
  toggleResourceDisable: (name: string) => Promise<void>;
  cycleStatusFilter: () => void;
  resetStatusFilter: () => void;
}

const TiltContext = createContext<TiltContextValue>();

export function TiltProvider(
  props: ParentProps<{ host?: string; port?: number }>,
) {
  const client = new TiltClient({ host: props.host, port: props.port });

  const logStore = new LogStore();

  const [state, setState] = createStore<TiltState>({
    connectionStatus: "connecting",
    clusterContext: "docker-desktop",
    namespace: "",
    resources: [],
    selectedResource: null,
    statusFilter: "all",
  });

  // Task handle for the main Effection operation
  let mainTask: Task<void> | null = null;

  /**
   * Update resources in the store.
   * This is called for each WebSocket message, processed serially.
   */
  function updateResources(updatedResources: Resource[]) {
    setState(
      produce((s) => {
        s.connectionStatus = "connected";
        s.resources = updatedResources.reduce(
          (existingResources, updatedResource) => {
            const existingResourceIndex = existingResources.findIndex(
              (existingResource) =>
                existingResource.name === updatedResource.name,
            );

            if (existingResourceIndex > -1) {
              const existingResource = existingResources[existingResourceIndex];
              const buttons = mergeButtons(
                existingResource.buttons,
                updatedResource.buttons,
              );

              existingResources[existingResourceIndex] = {
                ...existingResource,
                ...updatedResource,
                // buttons can get blanked out by resource updates, so make sure we merge updated buttons in
                buttons,
              };
              return existingResources;
            }

            return [...existingResources, updatedResource];
          },
          [...s.resources],
        );

        // Extract cluster context and namespace from resources
        for (const r of s.resources) {
          if (r.raw?.metadata?.annotations?.["tilt.dev/cluster"]) {
            s.clusterContext = r.raw.metadata.annotations["tilt.dev/cluster"];
          }
          if (r.raw?.metadata?.labels?.["tilt.dev/namespace"]) {
            s.namespace = r.raw.metadata.labels["tilt.dev/namespace"];
          }
        }

        // Auto-select first resource if none selected
        if (!s.selectedResource && s.resources.length > 0) {
          s.selectedResource = s.resources[0].name;
        }
      }),
    );
  }

  function mergeButtons(target: ButtonAction[], source: ButtonAction[]) {
    return source.reduce(
      (existingButtons, updatedButton) => {
        const existingButtonIndex = existingButtons.findIndex(
          (existingButton) => existingButton.name === updatedButton.name,
        );

        if (existingButtonIndex > -1) {
          existingButtons[existingButtonIndex] = updatedButton;
          return existingButtons;
        }

        return [...existingButtons, updatedButton];
      },
      [...target],
    );
  }

  function updateButtons(buttons: APIButton[]) {
    setState(
      produce((s) => {
        const { resources } = s;

        const buttonMap = new Map<string, ButtonAction[]>();

        for (const btn of buttons) {
          const resourceName =
            btn.spec.location?.componentType === "Resource"
              ? btn.spec.location.componentID
              : "";
          if (resourceName) {
            // Regular button - add to buttons list
            const existing = buttonMap.get(resourceName) ?? [];
            existing.push(buttonActionFromAPIButton(btn));
            buttonMap.set(resourceName, existing);
          }
        }

        for (const resource of resources) {
          const btns = buttonMap.get(resource.name);
          if (btns) {
            // buttons can get blanked out by resource updates, so make sure we merge updated buttons in
            resource.buttons = mergeButtons(resource.buttons, btns);
          }
        }
      }),
    );
  }

  /**
   * Main Effection operation that manages the WebSocket connection.
   * Handles reconnection and processes messages serially using `each()`.
   *
   * Uses useTiltStreams() to get two subscriptions from one WebSocket:
   * - resources: for resource/button updates
   * - logs: for log updates (replaces polling)
   */
  function* mainOperation(): Operation<void> {
    while (true) {
      setState("connectionStatus", "connecting");

      try {
        // Get both streams from a single WebSocket connection
        const { resources, buttons, logs } = yield* client.useTiltStreams();

        setState("connectionStatus", "connected");

        // Spawn both consumers concurrently
        // When WebSocket disconnects, both streams close and tasks complete
        const resourcesTask = yield* spawn(function* () {
          for (const update of yield* each(resources)) {
            updateResources(update.resources);
            yield* each.next();
          }
        });

        const buttonsTask = yield* spawn(function* () {
          for (const update of yield* each(buttons)) {
            updateButtons(update.buttons);
            yield* each.next();
          }
        });

        const logsTask = yield* spawn(function* () {
          for (const update of yield* each(logs)) {
            logStore.append(update.logList);
            yield* each.next();
          }
        });

        // Wait for all streams to close (indicates WebSocket disconnect)
        // When this returns, the scope exits and logsTask is automatically cleaned up
        yield* all([resourcesTask, buttonsTask, logsTask]);

        // Stream closed normally - reconnect
        console.log("WebSocket stream closed, reconnecting...");
      } catch (err) {
        console.error("WebSocket error:", err);
      }

      // Connection lost or errored - wait before reconnecting
      setState("connectionStatus", "disconnected");
      yield* sleep(3000);
    }
  }

  function selectResource(name: string) {
    setState("selectedResource", name);
  }

  function cycleStatusFilter() {
    setState("statusFilter", (current) => {
      const idx = FILTER_ORDER.indexOf(current);
      return FILTER_ORDER[(idx + 1) % FILTER_ORDER.length];
    });
  }

  function resetStatusFilter() {
    setState("statusFilter", "all");
  }

  async function triggerResource(name: string) {
    try {
      await client.triggerResource(name);
    } catch (err) {
      console.error("Failed to trigger resource:", err);
    }
  }

  async function toggleResourceDisable(name: string) {
    const resourceIndex = state.resources.findIndex((r) => r.name === name);
    if (resourceIndex === -1) {
      console.error(`Resource not found: ${name}`);
      return;
    }

    const resource = state.resources[resourceIndex];
    const button = resource.buttons.find(isDisableToggleButton);
    if (!button) {
      console.error(`No disable toggle button found for resource: ${name}`);
      return;
    }

    try {
      // The button's hidden "action" input already has the correct value set by Tilt:
      // - "on" when resource is enabled (click to disable)
      // - "off" when resource is disabled (click to enable)
      // So we don't need to override it - just click the button with its existing values
      const updatedButton = await client.clickButton(button.raw, {});

      // Update the button in the store with the new resourceVersion
      // This prevents 409 Conflict errors on subsequent clicks before WebSocket updates
      setState(
        "resources",
        resourceIndex,
        "disableToggleButton",
        updatedButton,
      );
    } catch (err) {
      console.error(`Failed to toggle disable for resource ${name}:`, err);
    }
  }

  onMount(() => {
    // Start the main Effection operation using run()
    // run() embeds Effection into existing async code
    mainTask = run(mainOperation);
  });

  onCleanup(async () => {
    // Halt the main task - this will close the WebSocket via structured concurrency
    if (mainTask) {
      // halt() returns a Future - we must observe it to ensure shutdown completes
      await mainTask.halt();
    }
  });

  const value: TiltContextValue = {
    state,
    client,
    logStore,
    selectResource,
    triggerResource,
    toggleResourceDisable,
    cycleStatusFilter,
    resetStatusFilter,
  };

  return (
    <TiltContext.Provider value={value}>{props.children}</TiltContext.Provider>
  );
}

export function useTilt() {
  const context = useContext(TiltContext);
  if (!context) {
    throw new Error("useTilt must be used within a TiltProvider");
  }
  return context;
}
