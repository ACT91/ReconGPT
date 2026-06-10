from typing import Dict, Any
import openai
from app.core.config import settings
from app.ai.prompts import ANALYSIS_PROMPT

openai.api_key = settings.OPENAI_API_KEY

def analyze_scan_results(target: str, artifacts: Dict[str, Any]) -> Dict[str, Any]:
    prompt = ANALYSIS_PROMPT.format(
        target=target,
        subdomains_count=len(artifacts.get("subdomains", [])),
        live_hosts_count=len(artifacts.get("live_hosts", [])),
        endpoints_count=len(artifacts.get("endpoints", [])),
        vulnerabilities=artifacts.get("vulnerabilities", [])
    )
    
    try:
        response = openai.ChatCompletion.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "You are a security researcher analyzing reconnaissance data."},
                {"role": "user", "content": prompt}
            ],
            temperature=settings.AI_TEMPERATURE
        )
        
        analysis_text = response.choices[0].message.content
        
        return {
            "target": target,
            "analysis": analysis_text,
            "risk_score": calculate_risk_score(artifacts),
            "recommendations": extract_recommendations(analysis_text)
        }
    except Exception as e:
        return {
            "target": target,
            "error": str(e),
            "risk_score": 0
        }

def calculate_risk_score(artifacts: Dict[str, Any]) -> float:
    score = 0.0
    vulns = artifacts.get("vulnerabilities", [])
    
    for vuln in vulns:
        severity = vuln.get("info", {}).get("severity", "").lower()
        if severity == "critical":
            score += 10
        elif severity == "high":
            score += 7
        elif severity == "medium":
            score += 4
        elif severity == "low":
            score += 2
    
    return min(score, 100.0)

def extract_recommendations(analysis: str) -> list:
    # Simple extraction - can be enhanced
    lines = analysis.split('\n')
    return [line.strip('- ') for line in lines if line.strip().startswith('-')]
