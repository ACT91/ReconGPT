ANALYSIS_PROMPT = """
Analyze the following reconnaissance scan results for {target}:

## Scan Summary
- Subdomains discovered: {subdomains_count}
- Live hosts: {live_hosts_count}
- Endpoints found: {endpoints_count}
- Vulnerabilities: {vulnerabilities}

## Task
1. Identify the most critical attack surface areas
2. Prioritize vulnerabilities by exploitability and impact
3. Suggest next recon steps
4. Highlight unusual patterns or high-value targets
5. Provide actionable security recommendations

## Format
Return a structured analysis with:
- Critical findings (top 5)
- Attack surface assessment
- Recommended next steps
- Risk rating (1-10)
"""
