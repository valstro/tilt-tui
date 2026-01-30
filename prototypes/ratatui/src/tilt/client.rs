//! Tilt API client

use crate::tilt::types::*;
use chrono::{DateTime, Utc};
use reqwest::Client;
use std::collections::HashMap;
use thiserror::Error;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures::StreamExt;

const DEFAULT_HOST: &str = "localhost";
const DEFAULT_PORT: u16 = 10350;

#[derive(Error, Debug)]
pub enum TiltError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("WebSocket error: {0}")]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("URL error: {0}")]
    Url(#[from] url::ParseError),
    #[error("Connection error: {0}")]
    Connection(String),
}

pub type Result<T> = std::result::Result<T, TiltError>;

/// Initial data from websocket connection
pub struct InitialData {
    pub resources: Vec<Resource>,
    pub buttons: Vec<UIButton>,
}

/// Tilt API client
pub struct TiltClient {
    base_url: String,
    ws_url: String,
    client: Client,
}

impl TiltClient {
    pub fn new(host: Option<&str>, port: Option<u16>) -> Self {
        let host = host.unwrap_or(DEFAULT_HOST);
        let port = port.unwrap_or(DEFAULT_PORT);

        Self {
            base_url: format!("http://{}:{}", host, port),
            ws_url: format!("ws://{}:{}", host, port),
            client: Client::new(),
        }
    }

    /// Get websocket token for authentication
    async fn get_websocket_token(&self) -> Result<String> {
        let url = format!("{}/api/websocket_token", self.base_url);
        let response = self.client.get(&url).send().await?;
        let token = response.text().await?;
        Ok(token)
    }

    /// Get initial data via websocket
    pub async fn get_initial_data(&self) -> Result<InitialData> {
        let token = self.get_websocket_token().await?;
        let ws_url = format!("{}/ws/view?csrf={}", self.ws_url, urlencoding::encode(&token));

        let (mut ws_stream, _) = connect_async(&ws_url).await?;

        // Read messages until we get a complete one
        while let Some(msg) = ws_stream.next().await {
            match msg? {
                Message::Text(text) => {
                    let view_resp: ViewResponse = serde_json::from_str(&text)?;
                    
                    if !view_resp.is_complete {
                        continue;
                    }

                    let resources: Vec<Resource> = view_resp
                        .ui_resources
                        .iter()
                        .map(Resource::from_api_resource)
                        .collect();

                    ws_stream.close(None).await.ok();

                    return Ok(InitialData {
                        resources,
                        buttons: view_resp.ui_buttons,
                    });
                }
                Message::Close(_) => {
                    return Err(TiltError::Connection("WebSocket closed unexpectedly".into()));
                }
                _ => continue,
            }
        }

        Err(TiltError::Connection("WebSocket stream ended".into()))
    }

    /// Get resources via HTTP polling
    pub async fn get_resources(&self) -> Result<Vec<Resource>> {
        let url = format!("{}/api/view", self.base_url);
        let response = self.client.get(&url).send().await?;
        let view_resp: ViewResponse = response.json().await?;

        let resources: Vec<Resource> = view_resp
            .ui_resources
            .iter()
            .map(Resource::from_api_resource)
            .collect();

        Ok(resources)
    }

    /// Get logs for a specific resource
    pub async fn get_logs(&self, resource_name: &str) -> Result<Vec<LogEntry>> {
        let url = if resource_name.is_empty() || resource_name == "(Tiltfile)" {
            format!("{}/api/view", self.base_url)
        } else {
            format!("{}/api/view?name={}", self.base_url, urlencoding::encode(resource_name))
        };

        let response = self.client.get(&url).send().await?;
        let view_resp: ViewResponse = response.json().await?;

        let Some(log_list) = view_resp.log_list else {
            return Ok(Vec::new());
        };

        // Build span to manifest mapping
        let span_to_manifest: HashMap<String, String> = log_list
            .spans
            .iter()
            .filter_map(|(span_id, span)| {
                span.as_ref().map(|s| (span_id.clone(), s.manifest_name.clone()))
            })
            .collect();

        let mut entries = Vec::new();
        for seg in &log_list.segments {
            // Filter by resource if specified
            if !resource_name.is_empty() {
                if let Some(manifest) = span_to_manifest.get(&seg.span_id) {
                    if manifest != resource_name && !manifest.is_empty() {
                        continue;
                    }
                }
            }

            let timestamp = DateTime::parse_from_rfc3339(&seg.time)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            entries.push(LogEntry {
                timestamp,
                span_id: seg.span_id.clone(),
                level: seg.level.clone(),
                text: seg.text.trim_end_matches('\n').to_string(),
                source: span_to_manifest.get(&seg.span_id).cloned().unwrap_or_default(),
            });
        }

        Ok(entries)
    }

    /// Trigger a resource rebuild
    pub async fn trigger_resource(&self, resource_name: &str) -> Result<()> {
        let url = format!("{}/api/trigger", self.base_url);
        let body = serde_json::json!({
            "manifest_names": [resource_name],
            "build_reason": 16
        });

        let response = self.client
            .post(&url)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(TiltError::Connection(format!(
                "Trigger failed with status: {}",
                response.status()
            )));
        }

        Ok(())
    }

    /// Check if Tilt server is running
    pub async fn check_health(&self) -> bool {
        let url = format!("{}/api/view", self.base_url);
        self.client.get(&url).send().await.is_ok()
    }
}
