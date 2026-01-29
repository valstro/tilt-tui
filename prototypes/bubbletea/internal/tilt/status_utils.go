package tilt

// getCombinedStatus returns a combined status following Tilt's logic:
// 1) Build status takes priority over runtime status
// 2) If build status is not healthy or none, use it
// 3) Otherwise, use runtime status
func getCombinedStatus(r *Resource) string {
	buildStat := getBuildStatus(r)
	runtimeStat := getRuntimeStatus(r)

	// Build status takes priority
	if buildStat != "healthy" && buildStat != "none" {
		return buildStat
	}

	// If runtime is none, use build status
	if runtimeStat == "none" {
		return buildStat
	}

	return runtimeStat
}

// getBuildStatus determines build status from update status
func getBuildStatus(r *Resource) string {
	if r.IsDisabled {
		return "disabled"
	}

	switch r.UpdateStatus {
	case "in_progress":
		return "building"
	case "pending":
		return "pending"
	case "not_applicable", "none", "":
		return "none"
	case "error":
		return "unhealthy"
	case "ok":
		// TODO: Check for build warnings from logs
		return "healthy"
	default:
		return "none"
	}
}

// getRuntimeStatus determines runtime status
func getRuntimeStatus(r *Resource) string {
	if r.IsDisabled {
		return "disabled"
	}

	// TODO: Check for runtime warnings from logs

	switch r.RuntimeStatus {
	case "error":
		return "unhealthy"
	case "pending":
		return "pending"
	case "ok":
		return "healthy"
	case "not_applicable", "none", "":
		return "none"
	default:
		return "none"
	}
}
