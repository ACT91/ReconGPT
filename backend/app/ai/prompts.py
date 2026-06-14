EXECUTIVE_SUMMARY_SYSTEM = """You are an expert security analyst specializing in attack surface management and reconnaissance analysis. You produce concise, actionable executive summaries of security scan results."""

EXECUTIVE_SUMMARY_PROMPT = """Analyze the following reconnaissance scan results for the target domain: {target}

## Scan Results Summary
- **Subdomains Discovered**: {subdomains_count}
- **Live Hosts**: {live_hosts_count}
- **Endpoints Found**: {endpoints_count}
- **Vulnerabilities Found**: {vulnerabilities_count}
- **Technologies Detected**: {technologies_count}

## Vulnerability Breakdown
{vulnerability_breakdown}

## Technologies Identified
{technologies_list}

## Task
Please provide:
1. **Executive Summary** (2-3 paragraphs): High-level overview of the attack surface, key risks, and overall security posture
2. **Critical Findings** (top 5 risks): Each with severity, affected component, and impact
3. **Attack Surface Assessment**: Key observations about exposed services, technologies, and potential attack vectors
4. **Recommended Next Steps**: Prioritized action items for the security team
5. **Risk Rating**: A score from 1-10 with brief justification

Format your response as a structured JSON with these keys: executive_summary, critical_findings (array), attack_surface_assessment, recommended_next_steps (array), risk_score (number between 1-10), risk_rationale"""


INSIGHT_GENERATION_SYSTEM = """You are an AI security analyst that generates structured, prioritized insights from reconnaissance and vulnerability scan data. Always return valid JSON."""

RISK_ANALYSIS_PROMPT = """Analyze the following security scan data and generate prioritized risk insights:

Target: {target}
Subdomains: {subdomains_sample}
Live Hosts: {live_hosts_sample}
Critical/High Vulnerabilities: {critical_vulns}
Technologies: {technologies}

Generate risk insights covering:
1. High-priority attack vectors targeting the most exposed assets
2. Vulnerability prioritization based on exploitability and business impact
3. Suggested manual testing steps for each critical finding
4. Anomalies or unusual patterns in the attack surface

Return as JSON array with each insight having: title, type (high_priority_targets/vulnerability_prioritization/manual_testing/anomaly), priority (critical/high/medium/low), content, affected_assets array, and priority_score (0-100)."""


TECHNOLOGY_ANALYSIS_PROMPT = """Analyze the technology stack detected for {target}:

Technologies: {technologies}

For each technology, assess:
1. Version exposure (known vulnerabilities)
2. Misconfiguration risks
3. Outdated or deprecated components
4. Recommended security hardening

Return as JSON array with: technology, risk_level (low/medium/high/critical), concerns array, recommendations array."""


SUMMARIZATION_PROMPT = """You are a security report summarizer. Summarize the following scan analysis into a concise 2-paragraph executive summary focusing on:
- Most critical risks
- Overall security posture
- Immediate action items

Analysis text:
{analysis_text}

Return as JSON with keys: executive_summary, key_risks (array of strings), immediate_actions (array of strings)."""