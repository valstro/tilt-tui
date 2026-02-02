# BUGS

- buttons
  - disable doesn't update resource tree ui state
  - ui buttons can only be triggered once.

- ui
  - more padding around tree items

# ROADMAP

- split pane
- favorites
- actions
- links
- command palate
- search
- log filtering
  - filter by type of log (build, cluster, cmd, disabletoggle-\*, tiltfile)

# Scratch

```
curl 'http://localhost:10350/proxy/apis/tilt.dev/v1alpha1/uibuttons/toggle-web-disable/status' \
  -X 'PUT' \
  -H 'Accept: application/json' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -b 'Tilt-Token=f1e906bc-f31f-4966-b8ca-fef73253299d' \
  -H 'Origin: http://localhost:10350' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:10350/r/web/overview' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"metadata":{"name":"toggle-web-disable","uid":"e4063e58-89c0-4f3b-8342-5ca2b29b7993","resourceVersion":"652","creationTimestamp":"2026-02-01T03:56:01Z","annotations":{"tilt.dev/uibutton-type":"DisableToggle","uibuttonspec-hash":"85d40b3d54243d471b94"},"ownerReferences":[{"apiVersion":"tilt.dev/v1alpha1","kind":"ToggleButton","name":"web-disable","uid":"234b95e9-0682-4945-94e8-0a7015a08f34","controller":true,"blockOwnerDeletion":true}],"managedFields":[{"manager":"tilt","operation":"Update","apiVersion":"tilt.dev/v1alpha1","time":"2026-02-02T03:56:36Z","fieldsType":"FieldsV1","fieldsV1":{"Raw":"eyJmOm1ldGFkYXRhIjp7ImY6YW5ub3RhdGlvbnMiOnsiLiI6e30sImY6dGlsdC5kZXYvdWlidXR0b24tdHlwZSI6e30sImY6dWlidXR0b25zcGVjLWhhc2giOnt9fSwiZjpvd25lclJlZmVyZW5jZXMiOnsiLiI6e30sIms6e1widWlkXCI6XCIyMzRiOTVlOS0wNjgyLTQ5NDUtOTRlOC0wYTcwMTVhMDhmMzRcIn0iOnt9fX0sImY6c3BlYyI6eyJmOmlucHV0cyI6e30sImY6bG9jYXRpb24iOnsiZjpjb21wb25lbnRJRCI6e30sImY6Y29tcG9uZW50VHlwZSI6e319LCJmOnJlcXVpcmVzQ29uZmlybWF0aW9uIjp7fSwiZjp0ZXh0Ijp7fX19"}}]},"status":{"lastClickedAt":"2026-02-02T06:31:15.514000+00:00","inputs":[{"name":"action","hidden":{"value":"on"}}]}}' ;
curl 'http://localhost:10350/proxy/apis/tilt.dev/v1alpha1/uibuttons/toggle-web-disable/status' \
  -X 'PUT' \
  -H 'Accept: application/json' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -b 'Tilt-Token=f1e906bc-f31f-4966-b8ca-fef73253299d' \
  -H 'Origin: http://localhost:10350' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:10350/r/web/overview' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"metadata":{"name":"toggle-web-disable","uid":"e4063e58-89c0-4f3b-8342-5ca2b29b7993","resourceVersion":"731","creationTimestamp":"2026-02-01T03:56:01Z","annotations":{"tilt.dev/uibutton-type":"DisableToggle","uibuttonspec-hash":"c7312af1affd0a492f60"},"ownerReferences":[{"apiVersion":"tilt.dev/v1alpha1","kind":"ToggleButton","name":"web-disable","uid":"234b95e9-0682-4945-94e8-0a7015a08f34","controller":true,"blockOwnerDeletion":true}],"managedFields":[{"manager":"tilt","operation":"Update","apiVersion":"tilt.dev/v1alpha1","time":"2026-02-02T06:31:15Z","fieldsType":"FieldsV1","fieldsV1":{"Raw":"eyJmOm1ldGFkYXRhIjp7ImY6YW5ub3RhdGlvbnMiOnsiLiI6e30sImY6dGlsdC5kZXYvdWlidXR0b24tdHlwZSI6e30sImY6dWlidXR0b25zcGVjLWhhc2giOnt9fSwiZjpvd25lclJlZmVyZW5jZXMiOnsiLiI6e30sIms6e1widWlkXCI6XCIyMzRiOTVlOS0wNjgyLTQ5NDUtOTRlOC0wYTcwMTVhMDhmMzRcIn0iOnt9fX0sImY6c3BlYyI6eyJmOmlucHV0cyI6e30sImY6bG9jYXRpb24iOnsiZjpjb21wb25lbnRJRCI6e30sImY6Y29tcG9uZW50VHlwZSI6e319LCJmOnRleHQiOnt9fX0="}}]},"status":{"lastClickedAt":"2026-02-02T06:31:17.881000+00:00","inputs":[{"name":"action","hidden":{"value":"off"}}]}}'
```
