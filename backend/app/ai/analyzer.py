from typing import Dict, Any, List, Optional
import json
import tiktoken
from openai import AsyncOpenAI
from app.core.config import settings
from app.ai.prompts import (
    EXECUTIVE_SUMMARY_PROMPT,
    EXECUTIVE_SUMMARY_SYSTEM,
    RISK_ANALYSIS_PROMPT,
    TECHNOLOGY_ANALYSIS_PROMPT,
)
from app.core.logger import get_logger


logger = get_logger(__name__)

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.AI_BASE_URL, timeout=settings.AI_TIMEOUT)


def _get_encoding():
    try:
        return tiktoken.get_encoding("cl100k_base")
    except Exception:
        return None


encoding = _get_encoding()


def count_tokens(text: str) -> int:
    if encoding is None:
        return 0
    return len(encoding.encode(text))


def truncate_to_token_limit(text: str, max_tokens: int = 8000) -> str:
    if encoding is None:
        return text
    tokens = encoding.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return encoding.decode(tokens[:max_tokens])


async def analyze_scan_results(target: str, artifacts: Dict[str, Any]) -> Dict[str, Any]:
    try:
        vulnerability_breakdown = _build_vulnerability_breakdown(artifacts.get("vulnerabilities", []))
        technologies_list = _build_technologies_list(artifacts.get("technologies", {}))
        
        prompt = EXECUTIVE_SUMMARY_PROMPT.format(
            target=target,
            subdomains_count=len(artifacts.get("subdomains", [])),
            live_hosts_count=len(artifacts.get("live_hosts", [])),
            endpoints_count=len(artifacts.get("endpoints", [])),
            vulnerabilities_count=len(artifacts.get("vulnerabilities", [])),
            technologies_count=len(artifacts.get("technologies", {})),
            vulnerability_breakdown=vulnerability_breakdown,
            technologies_list=technologies_list,
        )
        
        prompt = truncate_to_token_limit(prompt)
        
        logger.info("ai_analysis_started", target=target, tokens=count_tokens(prompt))
        
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": EXECUTIVE_SUMMARY_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=settings.AI_TEMPERATURE,
            max_tokens=settings.AI_MAX_TOKENS,
            response_format={"type": "json_object"},
        )
        
        analysis_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
        
        logger.info("ai_analysis_completed", target=target, tokens_used=tokens_used)
        
        try:
            analysis_json = json.loads(analysis_text)
        except json.JSONDecodeError:
            analysis_json = {
                "executive_summary": analysis_text,
                "critical_findings": [],
                "attack_surface_assessment": "",
                "recommended_next_steps": [],
                "risk_score": 5,
                "risk_rationale": "Analysis parsing error",
            }
        
        return {
            "target": target,
            "analysis": analysis_json,
            "risk_score": analysis_json.get("risk_score", calculate_risk_score(artifacts)),
            "tokens_used": tokens_used,
            "model_used": settings.AI_MODEL,
        }
        
    except Exception as e:
        logger.error("ai_analysis_failed", target=target, error=str(e))
        return {
            "target": target,
            "error": str(e),
            "risk_score": calculate_risk_score(artifacts),
            "tokens_used": 0,
            "model_used": settings.AI_MODEL,
        }


def calculate_risk_score(artifacts: Dict[str, Any]) -> float:
    score = 0.0
    vulns = artifacts.get("vulnerabilities", [])
    
    severity_weights = {"critical": 10, "high": 7, "medium": 4, "low": 2, "info": 1}
    
    for vuln in vulns:
        info = vuln.get("info", {}) if isinstance(vuln, dict) else {}
        severity = (info.get("severity", "info") or "info").lower()
        score += severity_weights.get(severity, 1)
    
    exposure = len(artifacts.get("live_hosts", [])) * 2 + len(artifacts.get("endpoints", [])) * 0.5
    score += min(exposure, 30)
    
    return min(score, 100.0)


def _build_vulnerability_breakdown(vulnerabilities: List[Dict[str, Any]]) -> str:
    if not vulnerabilities:
        return "No vulnerabilities found."
    
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for v in vulnerabilities:
        info = v.get("info", {}) if isinstance(v, dict) else {}
        severity = (info.get("severity", "info") or "info").lower()
        if severity in counts:
            counts[severity] += 1
    
    breakdown = f"Critical: {counts['critical']}, High: {counts['high']}, Medium: {counts['medium']}, Low: {counts['low']}, Info: {counts['info']}"
    
    critical_vulns = [v for v in vulnerabilities if (v.get("info", {}) if isinstance(v, dict) else {}).get("severity", "").lower() in ["critical", "high"]]
    if critical_vulns:
        lines = ["\n\nTop vulnerabilities:"]
        for v in critical_vulns[:5]:
            info = v.get("info", {}) if isinstance(v, dict) else {}
            name = info.get("name", "Unknown")
            severity = info.get("severity", "unknown")
            url = v.get("host", v.get("url", "N/A"))
            lines.append(f"- [{severity.upper()}] {name} at {url}")
        breakdown += "\n".join(lines)
    
    return breakdown


def _build_technologies_list(technologies: Dict[str, Any]) -> str:
    if not technologies:
        return "No technologies detected."
    
    if isinstance(technologies, dict):
        return "\n".join([f"- {tech}: {len(hosts)} hosts" for tech, hosts in list(technologies.items())[:20]])
    
    return str(technologies)[:500]