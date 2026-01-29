package tilt

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	defaultHost = "localhost"
	defaultPort = 10350
)

// Client is a Tilt API client
type Client struct {
	baseURL    string
	wsURL      string
	httpClient *http.Client
}

// NewClient creates a new Tilt API client
func NewClient(host string, port int) *Client {
	if host == "" {
		host = defaultHost
	}
	if port == 0 {
		port = defaultPort
	}

	return &Client{
		baseURL: fmt.Sprintf("http://%s:%d", host, port),
		wsURL:   fmt.Sprintf("ws://%s:%d", host, port),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// InitialData contains the initial data from the websocket connection
type InitialData struct {
	Resources []Resource
	Buttons   []UIButton
}

// GetInitialData connects to the websocket and fetches initial resources and buttons
func (c *Client) GetInitialData(ctx context.Context) (*InitialData, error) {
	// First, get the CSRF token
	token, err := c.getWebsocketToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get websocket token: %w", err)
	}

	// Build websocket URL
	wsURL := fmt.Sprintf("%s/ws/view?csrf=%s", c.wsURL, url.QueryEscape(token))

	// Connect to websocket
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to websocket: %w", err)
	}
	defer conn.Close()

	// Read the first complete message
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			_, message, err := conn.ReadMessage()
			if err != nil {
				return nil, fmt.Errorf("failed to read websocket message: %w", err)
			}

			var viewResp ViewResponse
			if err := json.Unmarshal(message, &viewResp); err != nil {
				return nil, fmt.Errorf("failed to decode websocket message: %w", err)
			}

			// Wait for a complete message
			if !viewResp.IsComplete {
				continue
			}

			// Convert resources
			resources := make([]Resource, 0, len(viewResp.UIResources))
			for _, uir := range viewResp.UIResources {
				resources = append(resources, ResourceFromAPIResource(uir))
			}

			return &InitialData{
				Resources: resources,
				Buttons:   viewResp.UIButtons,
			}, nil
		}
	}
}

// getWebsocketToken fetches the CSRF token for websocket authentication
func (c *Client) getWebsocketToken(ctx context.Context) (string, error) {
	resp, err := c.doRequest(ctx, "GET", "/api/websocket_token", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// ClickButton triggers a button click
func (c *Client) ClickButton(ctx context.Context, buttonName string, inputs map[string]string) error {
	// Build the request body
	inputStatuses := make([]map[string]any, 0)
	for name, value := range inputs {
		inputStatuses = append(inputStatuses, map[string]any{
			"name": name,
			"text": map[string]string{"value": value},
		})
	}

	payload := map[string]any{
		"metadata": map[string]string{
			"name": buttonName,
		},
		"status": map[string]any{
			"lastClickedAt": time.Now().UTC().Format(time.RFC3339),
			"inputs":        inputStatuses,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal button click: %w", err)
	}

	resp, err := c.doRequest(ctx, "PUT", "/proxy/apis/tilt.dev/v1alpha1/uibuttons/"+buttonName+"/status", strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("failed to click button: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("button click failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// GetResources fetches all UIResources from Tilt
func (c *Client) GetResources(ctx context.Context) ([]Resource, error) {
	resp, err := c.doRequest(ctx, "GET", "/api/view", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch resources: %w", err)
	}
	defer resp.Body.Close()

	var viewResp ViewResponse
	if err := json.NewDecoder(resp.Body).Decode(&viewResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	resources := make([]Resource, 0, len(viewResp.UIResources))
	for _, uir := range viewResp.UIResources {
		resources = append(resources, ResourceFromAPIResource(uir))
	}

	return resources, nil
}

// GetLogs fetches logs for a specific resource
func (c *Client) GetLogs(ctx context.Context, resourceName string) ([]LogEntry, error) {
	path := "/api/view"
	if resourceName != "" && resourceName != "(Tiltfile)" {
		path = fmt.Sprintf("/api/view?name=%s", resourceName)
	}

	resp, err := c.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch logs: %w", err)
	}
	defer resp.Body.Close()

	var viewResp ViewResponse
	if err := json.NewDecoder(resp.Body).Decode(&viewResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if viewResp.LogList == nil {
		return nil, nil
	}

	// Build span to manifest mapping
	spanToManifest := make(map[string]string)
	if viewResp.LogList.SpansByManifest != nil {
		for spanID, span := range viewResp.LogList.SpansByManifest {
			if span != nil {
				spanToManifest[spanID] = span.ManifestName
			}
		}
	}

	entries := make([]LogEntry, 0, len(viewResp.LogList.Segments))
	for _, seg := range viewResp.LogList.Segments {
		// Filter by resource if specified
		if resourceName != "" {
			manifest := spanToManifest[seg.SpanID]
			if manifest != resourceName && manifest != "" {
				continue
			}
		}

		ts, _ := time.Parse(time.RFC3339, seg.Time)
		entry := LogEntry{
			Timestamp: ts,
			SpanID:    seg.SpanID,
			Level:     seg.Level,
			Text:      strings.TrimRight(seg.Text, "\n"),
			Source:    spanToManifest[seg.SpanID],
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// StreamLogs opens a streaming connection to get log updates
func (c *Client) StreamLogs(ctx context.Context, resourceName string, logChan chan<- LogEntry) error {
	path := "/api/view"
	if resourceName != "" {
		path = fmt.Sprintf("/api/view?name=%s", resourceName)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			line, err := reader.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return err
			}

			// Parse SSE data
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				var segment LogSegment
				if err := json.Unmarshal([]byte(data), &segment); err == nil {
					ts, _ := time.Parse(time.RFC3339, segment.Time)
					logChan <- LogEntry{
						Timestamp: ts,
						SpanID:    segment.SpanID,
						Level:     segment.Level,
						Text:      strings.TrimRight(segment.Text, "\n"),
					}
				}
			}
		}
	}
}

// TriggerResource triggers an update for a resource
func (c *Client) TriggerResource(ctx context.Context, resourceName string) error {
	body := fmt.Sprintf(`{"manifest_names":["%s"],"build_reason":16}`, resourceName)
	resp, err := c.doRequest(ctx, "POST", "/api/trigger", strings.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to trigger resource: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("trigger failed with status: %d", resp.StatusCode)
	}
	return nil
}

// CheckHealth checks if the Tilt server is running
func (c *Client) CheckHealth(ctx context.Context) error {
	resp, err := c.doRequest(ctx, "GET", "/api/view", nil)
	if err != nil {
		return fmt.Errorf("tilt server not reachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("tilt server returned status: %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}
