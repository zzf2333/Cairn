## USER
Add structured logging to the login endpoint so we capture user_id, ip, and outcome on every attempt.

## USER
Looks good. Decision: we'll keep these logs for 90 days and ship them to our existing log pipeline (no S3 bucket needed). That's it for today — we're done. Please close out the session properly.
