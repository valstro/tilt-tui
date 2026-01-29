package tilt

import "time"

// TiltApiResponse is the generic list response wrapper from Tilt API
type TiltApiResponse[T any] struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Items      []T    `json:"items"`
}

// TiltApiResourceMetadata contains metadata for a Tilt resource
type TiltApiResourceMetadata struct {
	Annotations       map[string]string `json:"annotations"`
	CreationTimestamp string            `json:"creationTimestamp"`
	Labels            map[string]string `json:"labels"`
	Name              string            `json:"name"`
	ResourceVersion   string            `json:"resourceVersion"`
	UID               string            `json:"uid"`
}

// TiltApiUIResource represents a single UIResource from the Tilt API
type TiltApiUIResource struct {
	APIVersion string                  `json:"apiVersion"`
	Kind       string                  `json:"kind"`
	Metadata   TiltApiResourceMetadata `json:"metadata"`
	Spec       map[string]any          `json:"spec"`
	Status     TiltResourceStatus      `json:"status"`
}

// TiltBuild represents build information
type TiltBuild struct {
	StartTime  *string  `json:"startTime,omitempty"`
	FinishTime *string  `json:"finishTime,omitempty"`
	Error      *string  `json:"error,omitempty"`
	Warnings   []string `json:"warnings,omitempty"`
	Edits      []string `json:"edits,omitempty"`
	Reason     *string  `json:"reason,omitempty"`
	SpanID     *string  `json:"spanID,omitempty"`
}

// TiltStatusSpec represents a resource spec entry
type TiltStatusSpec struct {
	ID   string `json:"id"`
	Type string `json:"type"` // "local" | "k8s" | "image"
}

// TiltStatusCondition represents a status condition
type TiltStatusCondition struct {
	LastTransitionTime string `json:"lastTransitionTime"`
	Reason             string `json:"reason"`
	Status             string `json:"status"` // "True" | "False" | "Unknown"
	Type               string `json:"type"`   // "UpToDate" | "Ready"
}

// TiltDisableStatus represents the disable status of a resource
type TiltDisableStatus struct {
	DisabledCount int `json:"disabledCount"`
	EnabledCount  int `json:"enabledCount"`
	Sources       any `json:"sources"`
	State         any `json:"state"`
}

// TiltK8sResourceStatusInfo contains K8s-specific resource info
type TiltK8sResourceStatusInfo struct {
	AllContainersReady bool     `json:"allContainersReady"`
	DisplayNames       []string `json:"displayNames"`
	PodCreationTime    string   `json:"podCreationTime"`
	PodName            string   `json:"podName"`
	PodRestarts        int      `json:"podRestarts"`
	PodStatus          string   `json:"podStatus"`
	PodUpdateStartTime *string  `json:"podUpdateStartTime"`
	SpanID             string   `json:"spanID"`
}

// TiltLocalResourceInfo contains local resource info
type TiltLocalResourceInfo struct {
	PID string `json:"pid,omitempty"`
}

// TiltEndpointLink represents an endpoint link for a resource
type TiltEndpointLink struct {
	URL  string `json:"url"`
	Name string `json:"name,omitempty"`
}

// TiltResourceStatus is the unified status type that covers all resource types
// Fields are optional as different resource types have different fields present
type TiltResourceStatus struct {
	// Common fields
	Order             int                   `json:"order"`
	Conditions        []TiltStatusCondition `json:"conditions"`
	DisableStatus     TiltDisableStatus     `json:"disableStatus"`
	PendingBuildSince *string               `json:"pendingBuildSince"`
	RuntimeStatus     string                `json:"runtimeStatus,omitempty"` // "ok" | "error" | "pending" | "not_applicable"
	UpdateStatus      string                `json:"updateStatus,omitempty"`  // "ok" | "error" | "pending" | "not_applicable" | "none"

	// Build-related fields
	BuildHistory   []TiltBuild `json:"buildHistory,omitempty"`
	LastDeployTime *string     `json:"lastDeployTime"`

	// Endpoint links
	EndpointLinks []TiltEndpointLink `json:"endpointLinks,omitempty"`

	// K8s-specific fields
	K8sResourceInfo *TiltK8sResourceStatusInfo `json:"k8sResourceInfo,omitempty"`
	Specs           []TiltStatusSpec           `json:"specs,omitempty"`

	// Local-specific fields
	LocalResourceInfo *TiltLocalResourceInfo `json:"localResourceInfo,omitempty"`
	TriggerMode       *int                   `json:"triggerMode,omitempty"`
}

// IsTiltfile returns true if this is the Tiltfile resource
func (s *TiltResourceStatus) IsTiltfile() bool {
	return s.Order == 1
}

// IsK8sResource returns true if this is a K8s resource
func (s *TiltResourceStatus) IsK8sResource() bool {
	return s.K8sResourceInfo != nil
}

// IsLocalResource returns true if this is a local resource
func (s *TiltResourceStatus) IsLocalResource() bool {
	return s.LocalResourceInfo != nil
}

// GetResourceType returns the primary type from specs
func (s *TiltResourceStatus) GetResourceType() string {
	for _, spec := range s.Specs {
		if spec.Type != "" {
			return spec.Type
		}
	}
	if s.IsTiltfile() {
		return "tiltfile"
	}
	return ""
}

// IsDisabled returns true if the resource is disabled
func (s *TiltResourceStatus) IsDisabled() bool {
	return s.DisableStatus.DisabledCount > 0 && s.DisableStatus.EnabledCount == 0
}

// HasPendingChanges returns true if there are pending changes
func (s *TiltResourceStatus) HasPendingChanges() bool {
	return s.PendingBuildSince != nil && *s.PendingBuildSince != ""
}

// GetLastBuildError returns the error from the most recent build, if any
func (s *TiltResourceStatus) GetLastBuildError() string {
	if len(s.BuildHistory) > 0 && s.BuildHistory[0].Error != nil {
		return *s.BuildHistory[0].Error
	}
	return ""
}

// LogEntry represents a single log line (for internal use)
type LogEntry struct {
	Timestamp time.Time
	SpanID    string
	Level     string
	Text      string
	Source    string
}

// LogSegment represents a log segment from the API
type LogSegment struct {
	SpanID string `json:"spanId"`
	Time   string `json:"time"`
	Text   string `json:"text"`
	Level  string `json:"level"`
}

// LogList contains log data from the view API
type LogList struct {
	Segments        []LogSegment        `json:"segments"`
	SpansByManifest map[string]*SpanSet `json:"spans"`
	FromCheckpoint  int                 `json:"fromCheckpoint"`
	ToCheckpoint    int                 `json:"toCheckpoint"`
}

// SpanSet maps span IDs to manifest names
type SpanSet struct {
	ManifestName string `json:"manifestName"`
}

// ViewResponse is the response from /api/view (legacy endpoint)
type ViewResponse struct {
	UISession   any                 `json:"uiSession"`
	UIResources []TiltApiUIResource `json:"uiResources"`
	UIButtons   []UIButton          `json:"uiButtons"`
	LogList     *LogList            `json:"logList"`
	IsComplete  bool                `json:"isComplete"`
}

// UIButton represents a custom action button from Tilt
type UIButton struct {
	Metadata TiltApiResourceMetadata `json:"metadata"`
	Spec     UIButtonSpec            `json:"spec"`
	Status   UIButtonStatus          `json:"status"`
}

// UIButtonSpec defines the button's configuration
type UIButtonSpec struct {
	Location             *UIComponentLocation `json:"location,omitempty"`
	Text                 string               `json:"text"`
	IconName             string               `json:"iconName,omitempty"`
	IconSVG              string               `json:"iconSVG,omitempty"`
	Disabled             bool                 `json:"disabled,omitempty"`
	RequiresConfirmation bool                 `json:"requiresConfirmation,omitempty"`
	Inputs               []UIInputSpec        `json:"inputs,omitempty"`
}

// UIComponentLocation associates a button with a resource
type UIComponentLocation struct {
	ComponentID   string `json:"componentID"`   // Resource name
	ComponentType string `json:"componentType"` // "Resource" for resource buttons
}

// UIInputSpec defines an input field for a button
type UIInputSpec struct {
	Name   string              `json:"name"`
	Label  string              `json:"label,omitempty"`
	Text   *UITextInputSpec    `json:"text,omitempty"`
	Bool   *UIBoolInputSpec    `json:"bool,omitempty"`
	Hidden *UIHiddenInputSpec  `json:"hidden,omitempty"`
	Choice *UIChoiceInputSpec  `json:"choice,omitempty"`
}

// UITextInputSpec defines a text input
type UITextInputSpec struct {
	DefaultValue string `json:"defaultValue,omitempty"`
	Placeholder  string `json:"placeholder,omitempty"`
}

// UIBoolInputSpec defines a boolean input
type UIBoolInputSpec struct {
	DefaultValue bool   `json:"defaultValue,omitempty"`
	TrueString   string `json:"trueString,omitempty"`
	FalseString  string `json:"falseString,omitempty"`
}

// UIHiddenInputSpec defines a hidden input
type UIHiddenInputSpec struct {
	Value string `json:"value,omitempty"`
}

// UIChoiceInputSpec defines a choice/select input
type UIChoiceInputSpec struct {
	Choices []string `json:"choices,omitempty"`
}

// UIButtonStatus contains the button's current status
type UIButtonStatus struct {
	LastClickedAt string          `json:"lastClickedAt,omitempty"`
	Inputs        []UIInputStatus `json:"inputs,omitempty"`
}

// UIInputStatus contains the current value of an input
type UIInputStatus struct {
	Name   string               `json:"name"`
	Text   *UITextInputStatus   `json:"text,omitempty"`
	Bool   *UIBoolInputStatus   `json:"bool,omitempty"`
	Hidden *UIHiddenInputStatus `json:"hidden,omitempty"`
	Choice *UIChoiceInputStatus `json:"choice,omitempty"`
}

// UITextInputStatus contains the current text value
type UITextInputStatus struct {
	Value string `json:"value"`
}

// UIBoolInputStatus contains the current bool value
type UIBoolInputStatus struct {
	Value bool `json:"value"`
}

// UIHiddenInputStatus contains the current hidden value
type UIHiddenInputStatus struct {
	Value string `json:"value"`
}

// UIChoiceInputStatus contains the current choice value
type UIChoiceInputStatus struct {
	Value string `json:"value"`
}

// GetResourceName returns the associated resource name, if any
func (b *UIButton) GetResourceName() string {
	if b.Spec.Location != nil && b.Spec.Location.ComponentType == "Resource" {
		return b.Spec.Location.ComponentID
	}
	return ""
}

// ButtonAction represents a processed button for display
type ButtonAction struct {
	Name         string
	Text         string
	ResourceName string
	Disabled     bool
	Inputs       []UIInputSpec
}

// ButtonActionFromUIButton converts a UIButton to a ButtonAction
func ButtonActionFromUIButton(btn UIButton) ButtonAction {
	return ButtonAction{
		Name:         btn.Metadata.Name,
		Text:         btn.Spec.Text,
		ResourceName: btn.GetResourceName(),
		Disabled:     btn.Spec.Disabled,
		Inputs:       btn.Spec.Inputs,
	}
}

// AssociateButtonsWithResources maps buttons to their respective resources
func AssociateButtonsWithResources(resources []Resource, buttons []UIButton) []Resource {
	// Build a map of resource name -> buttons
	buttonMap := make(map[string][]ButtonAction)
	for _, btn := range buttons {
		resourceName := btn.GetResourceName()
		if resourceName != "" {
			buttonMap[resourceName] = append(buttonMap[resourceName], ButtonActionFromUIButton(btn))
		}
	}

	// Associate buttons with resources
	for i := range resources {
		if btns, ok := buttonMap[resources[i].Name]; ok {
			resources[i].Buttons = btns
		}
	}

	return resources
}

// EndpointLink represents a processed endpoint link for display
type EndpointLink struct {
	Name string
	URL  string
}

// Resource represents a processed Tilt resource for display in the UI
type Resource struct {
	Name          string
	Type          string
	RuntimeStatus string
	UpdateStatus  string
	LastDeployAt  string
	BuildError    string
	PodStatus     string
	PodName       string
	Endpoints     []EndpointLink
	IsDisabled    bool
	HasPending    bool
	Order         int

	// Buttons associated with this resource
	Buttons []ButtonAction

	// Raw stores the original API resource for detailed inspection
	Raw *TiltApiUIResource
}

// EffectiveStatus returns the most relevant status for display
// Prioritizes error states, then runtime status, then update status
func (r *Resource) EffectiveStatus() string {
	if r.RuntimeStatus == "error" || r.UpdateStatus == "error" {
		return "error"
	}
	if r.RuntimeStatus == "pending" || r.UpdateStatus == "pending" {
		return "pending"
	}
	if r.RuntimeStatus == "ok" {
		return "ok"
	}
	if r.UpdateStatus == "ok" {
		return "ok"
	}
	return "not_applicable"
}

// ResourceFromAPIResource converts a TiltApiUIResource to a display Resource
func ResourceFromAPIResource(uir TiltApiUIResource) Resource {
	r := Resource{
		Name:          uir.Metadata.Name,
		RuntimeStatus: uir.Status.RuntimeStatus,
		UpdateStatus:  uir.Status.UpdateStatus,
		Type:          uir.Status.GetResourceType(),
		IsDisabled:    uir.Status.IsDisabled(),
		HasPending:    uir.Status.HasPendingChanges(),
		BuildError:    uir.Status.GetLastBuildError(),
		Order:         uir.Status.Order,
		Raw:           &uir,
	}

	if uir.Status.LastDeployTime != nil {
		r.LastDeployAt = *uir.Status.LastDeployTime
	}

	// Get endpoint links
	for _, link := range uir.Status.EndpointLinks {
		name := link.Name
		if name == "" {
			name = link.URL
		}
		r.Endpoints = append(r.Endpoints, EndpointLink{
			Name: name,
			URL:  link.URL,
		})
	}

	// Get K8s-specific info
	if uir.Status.K8sResourceInfo != nil {
		r.PodStatus = uir.Status.K8sResourceInfo.PodStatus
		r.PodName = uir.Status.K8sResourceInfo.PodName
	}

	return r
}
