/**
 * Sentry API Client
 * Server-side integration with Sentry for fetching error statistics
 */

interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  status: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
}

interface SentryStats {
  totalErrors: number;
  unresolvedErrors: number;
  lastErrorTime: number | null;
  errorRate: number;
  status: "healthy" | "warning" | "critical";
  issues: Array<{
    id: string;
    title: string;
    count: number;
    level: string;
    lastSeen: string;
  }>;
}

/**
 * Fetch Sentry statistics from the Sentry API
 * Requires SENTRY_AUTH_TOKEN and SENTRY_ORG environment variables
 */
export async function fetchSentryStats(): Promise<SentryStats> {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG || "cvalentine99";
  const project = process.env.SENTRY_PROJECT || "cvalentine99";
  
  // If no auth token, return simulated stats
  if (!authToken) {
    console.log("[Sentry API] No auth token configured, returning simulated stats");
    return getSimulatedStats();
  }

  try {
    const baseUrl = "https://sentry.io/api/0";
    const headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    };

    // Fetch unresolved issues
    const issuesResponse = await fetch(
      `${baseUrl}/projects/${org}/${project}/issues/?query=is:unresolved&statsPeriod=24h`,
      { headers }
    );

    if (!issuesResponse.ok) {
      console.error(`[Sentry API] Failed to fetch issues: ${issuesResponse.status}`);
      return getSimulatedStats();
    }

    const issues: SentryIssue[] = await issuesResponse.json();

    // Calculate statistics
    const unresolvedErrors = issues.length;
    const totalErrors = issues.reduce((sum, issue) => sum + parseInt(issue.count, 10), 0);
    
    // Find the most recent error
    let lastErrorTime: number | null = null;
    if (issues.length > 0) {
      const lastSeenDates = issues.map(i => new Date(i.lastSeen).getTime());
      lastErrorTime = Math.max(...lastSeenDates);
    }

    // Calculate error rate (errors per hour over last 24h)
    const errorRate = totalErrors / 24;

    // Determine status
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (unresolvedErrors > 10 || errorRate > 5) {
      status = "critical";
    } else if (unresolvedErrors > 3 || errorRate > 1) {
      status = "warning";
    }

    return {
      totalErrors,
      unresolvedErrors,
      lastErrorTime,
      errorRate,
      status,
      issues: issues.slice(0, 5).map(issue => ({
        id: issue.shortId,
        title: issue.title,
        count: parseInt(issue.count, 10),
        level: issue.level,
        lastSeen: issue.lastSeen,
      })),
    };
  } catch (error) {
    console.error("[Sentry API] Error fetching stats:", error);
    return getSimulatedStats();
  }
}

/**
 * Get simulated stats when Sentry API is not configured
 */
function getSimulatedStats(): SentryStats {
  return {
    totalErrors: 0,
    unresolvedErrors: 0,
    lastErrorTime: null,
    errorRate: 0,
    status: "healthy",
    issues: [],
  };
}

/**
 * Create a Sentry user feedback submission
 */
export async function submitSentryFeedback(params: {
  eventId: string;
  name: string;
  email: string;
  comments: string;
}): Promise<boolean> {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG || "cvalentine99";
  const project = process.env.SENTRY_PROJECT || "cvalentine99";

  if (!authToken) {
    console.log("[Sentry API] No auth token, feedback not submitted");
    return false;
  }

  try {
    const response = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/user-feedback/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: params.eventId,
          name: params.name,
          email: params.email,
          comments: params.comments,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("[Sentry API] Error submitting feedback:", error);
    return false;
  }
}
