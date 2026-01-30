//! Tilt API types

use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashMap;

/// Generic Tilt API response wrapper
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltApiResponse<T> {
    pub api_version: String,
    pub kind: String,
    pub items: Vec<T>,
}

/// Resource metadata
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltApiResourceMetadata {
    #[serde(default)]
    pub annotations: HashMap<String, String>,
    #[serde(default)]
    pub creation_timestamp: String,
    #[serde(default)]
    pub labels: HashMap<String, String>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub resource_version: String,
    #[serde(default)]
    pub uid: String,
}

/// UI Resource from Tilt API
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltApiUIResource {
    #[serde(default)]
    pub api_version: String,
    #[serde(default)]
    pub kind: String,
    pub metadata: TiltApiResourceMetadata,
    #[serde(default)]
    pub spec: serde_json::Value,
    #[serde(default)]
    pub status: TiltResourceStatus,
}

/// Build information
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltBuild {
    pub start_time: Option<String>,
    pub finish_time: Option<String>,
    pub error: Option<String>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub edits: Vec<String>,
    pub reason: Option<String>,
    pub span_id: Option<String>,
}

/// Status specification entry
#[derive(Debug, Clone, Deserialize)]
pub struct TiltStatusSpec {
    pub id: String,
    #[serde(rename = "type")]
    pub spec_type: String,
}

/// Status condition
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltStatusCondition {
    #[serde(default)]
    pub last_transition_time: String,
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub status: String,
    #[serde(default, rename = "type")]
    pub condition_type: String,
}

/// Disable status
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltDisableStatus {
    #[serde(default)]
    pub disabled_count: i32,
    #[serde(default)]
    pub enabled_count: i32,
    pub sources: Option<serde_json::Value>,
    pub state: Option<serde_json::Value>,
}

/// K8s-specific resource info
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltK8sResourceStatusInfo {
    #[serde(default)]
    pub all_containers_ready: bool,
    #[serde(default)]
    pub display_names: Vec<String>,
    #[serde(default)]
    pub pod_creation_time: String,
    #[serde(default)]
    pub pod_name: String,
    #[serde(default)]
    pub pod_restarts: i32,
    #[serde(default)]
    pub pod_status: String,
    pub pod_update_start_time: Option<String>,
    #[serde(default)]
    pub span_id: String,
}

/// Local resource info
#[derive(Debug, Clone, Deserialize)]
pub struct TiltLocalResourceInfo {
    pub pid: Option<String>,
}

/// Endpoint link
#[derive(Debug, Clone, Deserialize)]
pub struct TiltEndpointLink {
    pub url: String,
    pub name: Option<String>,
}

/// Resource status
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltResourceStatus {
    #[serde(default)]
    pub order: i32,
    #[serde(default)]
    pub conditions: Vec<TiltStatusCondition>,
    #[serde(default)]
    pub disable_status: TiltDisableStatus,
    pub pending_build_since: Option<String>,
    pub runtime_status: Option<String>,
    pub update_status: Option<String>,
    #[serde(default)]
    pub build_history: Vec<TiltBuild>,
    pub last_deploy_time: Option<String>,
    #[serde(default)]
    pub endpoint_links: Vec<TiltEndpointLink>,
    pub k8s_resource_info: Option<TiltK8sResourceStatusInfo>,
    #[serde(default)]
    pub specs: Vec<TiltStatusSpec>,
    pub local_resource_info: Option<TiltLocalResourceInfo>,
    pub trigger_mode: Option<i32>,
}

impl TiltResourceStatus {
    pub fn is_tiltfile(&self) -> bool {
        self.order == 1
    }

    pub fn is_k8s_resource(&self) -> bool {
        self.k8s_resource_info.is_some()
    }

    pub fn is_local_resource(&self) -> bool {
        self.local_resource_info.is_some()
    }

    pub fn get_resource_type(&self) -> String {
        for spec in &self.specs {
            if !spec.spec_type.is_empty() {
                return spec.spec_type.clone();
            }
        }
        if self.is_tiltfile() {
            return "tiltfile".to_string();
        }
        String::new()
    }

    pub fn is_disabled(&self) -> bool {
        self.disable_status.disabled_count > 0 && self.disable_status.enabled_count == 0
    }

    pub fn has_pending_changes(&self) -> bool {
        self.pending_build_since
            .as_ref()
            .map(|s| !s.is_empty())
            .unwrap_or(false)
    }

    pub fn get_last_build_error(&self) -> Option<String> {
        self.build_history
            .first()
            .and_then(|b| b.error.clone())
    }
}

/// Log segment from API
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogSegment {
    #[serde(default)]
    pub span_id: String,
    pub time: String,
    pub text: String,
    #[serde(default)]
    pub level: String,
}

/// Span set mapping
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanSet {
    #[serde(default)]
    pub manifest_name: String,
}

/// Log list from view API
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogList {
    #[serde(default)]
    pub segments: Vec<LogSegment>,
    #[serde(default)]
    pub spans: HashMap<String, Option<SpanSet>>,
    #[serde(default)]
    pub from_checkpoint: i32,
    #[serde(default)]
    pub to_checkpoint: i32,
}

/// UI Button spec
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UIButtonSpec {
    pub location: Option<UIComponentLocation>,
    pub text: String,
    pub icon_name: Option<String>,
    pub icon_svg: Option<String>,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub requires_confirmation: bool,
    #[serde(default)]
    pub inputs: Vec<serde_json::Value>,
}

/// UI component location
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UIComponentLocation {
    #[serde(default)]
    pub component_id: String,
    #[serde(default)]
    pub component_type: String,
}

/// UI Button status
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UIButtonStatus {
    pub last_clicked_at: Option<String>,
    #[serde(default)]
    pub inputs: Vec<serde_json::Value>,
}

/// UI Button
#[derive(Debug, Clone, Deserialize)]
pub struct UIButton {
    pub metadata: TiltApiResourceMetadata,
    pub spec: UIButtonSpec,
    #[serde(default)]
    pub status: UIButtonStatus,
}

impl UIButton {
    pub fn get_resource_name(&self) -> Option<String> {
        self.spec.location.as_ref().and_then(|loc| {
            if loc.component_type == "Resource" {
                Some(loc.component_id.clone())
            } else {
                None
            }
        })
    }
}

/// View response from /api/view
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewResponse {
    pub ui_session: Option<serde_json::Value>,
    #[serde(default)]
    pub ui_resources: Vec<TiltApiUIResource>,
    #[serde(default)]
    pub ui_buttons: Vec<UIButton>,
    pub log_list: Option<LogList>,
    #[serde(default)]
    pub is_complete: bool,
}

// Processed types for UI display

/// Processed log entry
#[derive(Debug, Clone)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub span_id: String,
    pub level: String,
    pub text: String,
    pub source: String,
}

/// Processed endpoint link
#[derive(Debug, Clone)]
pub struct EndpointLink {
    pub name: String,
    pub url: String,
}

/// Processed resource for display
#[derive(Debug, Clone)]
pub struct Resource {
    pub name: String,
    pub resource_type: String,
    pub runtime_status: String,
    pub update_status: String,
    pub last_deploy_at: String,
    pub build_error: String,
    pub pod_status: String,
    pub pod_name: String,
    pub endpoints: Vec<EndpointLink>,
    pub is_disabled: bool,
    pub has_pending: bool,
    pub order: i32,
    pub labels: HashMap<String, String>,
}

impl Resource {
    pub fn from_api_resource(uir: &TiltApiUIResource) -> Self {
        let mut resource = Resource {
            name: uir.metadata.name.clone(),
            runtime_status: uir
                .status
                .runtime_status
                .clone()
                .unwrap_or_else(|| "not_applicable".to_string()),
            update_status: uir
                .status
                .update_status
                .clone()
                .unwrap_or_else(|| "not_applicable".to_string()),
            resource_type: uir.status.get_resource_type(),
            is_disabled: uir.status.is_disabled(),
            has_pending: uir.status.has_pending_changes(),
            build_error: uir.status.get_last_build_error().unwrap_or_default(),
            order: uir.status.order,
            last_deploy_at: uir.status.last_deploy_time.clone().unwrap_or_default(),
            pod_status: String::new(),
            pod_name: String::new(),
            endpoints: Vec::new(),
            labels: uir.metadata.labels.clone(),
        };

        // Get endpoint links
        for link in &uir.status.endpoint_links {
            resource.endpoints.push(EndpointLink {
                name: link.name.clone().unwrap_or_else(|| link.url.clone()),
                url: link.url.clone(),
            });
        }

        // Get K8s-specific info
        if let Some(k8s_info) = &uir.status.k8s_resource_info {
            resource.pod_status = k8s_info.pod_status.clone();
            resource.pod_name = k8s_info.pod_name.clone();
        }

        resource
    }

    pub fn effective_status(&self) -> &str {
        if self.runtime_status == "error" || self.update_status == "error" {
            return "error";
        }
        if self.runtime_status == "pending" || self.update_status == "pending" {
            return "pending";
        }
        if self.runtime_status == "ok" {
            return "ok";
        }
        if self.update_status == "ok" {
            return "ok";
        }
        "not_applicable"
    }
}
