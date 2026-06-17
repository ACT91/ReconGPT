from typing import Dict, Any, List, Optional
import json
from datetime import datetime, timezone
from uuid import UUID
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.ai.prompts import RISK_ANALYSIS_PROMPT, EXECUTIVE_SUMMARY_SYSTEM
from app.core.logger import get_logger
from app.models.ai_insight import AiInsight, InsightType, InsightPriority
from app.core.database import async_session_factory


logger = get_logger(__name__)

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.AI_BASE_URL, timeout=settings.AI_TIMEOUT)


async def generate_insights_from_results(
    target: str,
    analysis: Dict[str, Any],
    artifacts: Dict[str, Any],
) -> List[Dict[str, Any]]:
    insights = []
    
    try:
        subdomains = artifacts.get("subdomains", [])
        live_hosts = artifacts.get("live_hosts", [])
        vulnerabilities = artifacts.get("vulnerabilities", [])
        technologies = artifacts.get("technologies", {})
        
        critical_vulns = [
            v for v in vulnerabilities
            if isinstance(v, dict) and (v.get("info", {}) if isinstance(v.get("info"), dict) else {}).get("severity", "").lower() in ["critical", "high"]
        ]
        
        prompt = RISK_ANALYSIS_PROMPT.format(
            target=target,
            subdomains_sample=json.dumps(subdomains[:20]),
            live_hosts_sample=json.dumps(live_hosts[:20]),
            critical_vulns=json.dumps(critical_vulns[:10]),
            technologies=json.dumps(dict(list(technologies.items())[:15])) if isinstance(technologies, dict) else str(technologies)[:500],
        )
        
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
        
        insights_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
        
        try:
            insights_data = json.loads(insights_text)
            if isinstance(insights_data, dict):
                insights_data = insights_data.get("insights", [insights_data])
            if isinstance(insights_data, list):
                for item in insights_data[:20]:
                    insight = _parse_insight_item(item, target)
                    insights.append(insight)
        except json.JSONDecodeError:
            insights.append(_create_generic_insight(target, insights_text))
    
    except Exception as e:
        logger.error("insight_generation_failed", target=target, error=str(e))
        insights.append(_create_fallback_insight(target))
    
    return insights


async def save_insights_to_db(job_id: UUID, insights: List[Dict[str, Any]]) -> int:
    saved_count = 0
    try:
        async with async_session_factory() as session:
            for item in insights:
                try:
                    insight = AiInsight(
                        scan_job_id=job_id,
                        insight_type=InsightType(item.get("type", InsightType.RECOMMENDATION)),
                        priority=InsightPriority(item.get("priority", InsightPriority.MEDIUM)),
                        priority_score=float(item.get("priority_score", 0)),
                        title=str(item.get("title", "Security Insight"))[:255],
                        content=str(item.get("content", "")),
                        summary=str(item.get("summary", ""))[:500] if item.get("summary") else None,
                        affected_assets=item.get("affected_assets", []),
                        related_vulnerabilities=item.get("related_vulnerabilities", []),
                        related_subdomains=item.get("related_subdomains", []),
                        related_endpoints=item.get("related_endpoints", []),
                        metadata=item.get("metadata", {}),
                        model_used=item.get("model_used", settings.AI_MODEL),
                        tokens_used=item.get("tokens_used"),
                        confidence=item.get("confidence"),
                        is_actionable=1 if item.get("priority") in ["critical", "high"] else 0,
                    )
                    session.add(insight)
                    saved_count += 1
                except Exception as e:
                    logger.warning(f"Failed to save insight: {e}")
                    continue
            
            if saved_count > 0:
                await session.commit()
    except Exception as e:
        logger.error(f"Failed to save insights to DB: {e}")
    
    return saved_count


def _parse_insight_item(item: Dict[str, Any], target: str) -> Dict[str, Any]:
    type_map = {
        "high_priority_targets": InsightType.HIGH_PRIORITY_TARGETS,
        "vulnerability_prioritization": InsightType.VULNERABILITY_PRIORITIZATION,
        "manual_testing": InsightType.MANUAL_TESTING,
        "anomaly": InsightType.ANOMALY,
        "attack_surface": InsightType.ATTACK_SURFACE,
        "recommendation": InsightType.RECOMMENDATION,
    }
    
    priority_map = {
        "critical": InsightPriority.CRITICAL,
        "high": InsightPriority.HIGH,
        "medium": InsightPriority.MEDIUM,
        "low": InsightPriority.LOW,
        "info": InsightPriority.INFO,
    }
    
    raw_type = str(item.get("type", "recommendation")).lower().replace(" ", "_")
    raw_priority = str(item.get("priority", "medium")).lower()
    
    return {
        "type": type_map.get(raw_type, InsightType.RECOMMENDATION),
        "priority": priority_map.get(raw_priority, InsightPriority.MEDIUM),
        "priority_score": min(max(float(item.get("priority_score", 50)), 0), 100),
        "title": str(item.get("title", f"Security finding for {target}"))[:255],
        "content": str(item.get("content", "")),
        "summary": str(item.get("summary", ""))[:500] if item.get("summary") else None,
        "affected_assets": item.get("affected_assets", []),
        "related_vulnerabilities": item.get("related_vulnerabilities", []),
        "related_subdomains": item.get("related_subdomains", []),
        "related_endpoints": item.get("related_endpoints", []),
        "metadata": {"target": target, **item.get("metadata", {})},
        "model_used": settings.AI_MODEL,
        "confidence": item.get("confidence"),
    }


def _create_generic_insight(target: str, text: str) -> Dict[str, Any]:
    return {
        "type": InsightType.EXECUTIVE_SUMMARY,
        "priority": InsightPriority.MEDIUM,
        "priority_score": 50,
        "title": f"Security Analysis for {target}",
        "content": text[:5000],
        "summary": text[:300],
        "affected_assets": [],
        "metadata": {"target": target},
    }


def _create_fallback_insight(target: str) -> Dict[str, Any]:
    return {
        "type": InsightType.RECOMMENDATION,
        "priority": InsightPriority.INFO,
        "priority_score": 10,
        "title": f"Scan completed for {target}",
        "content": f"Attack surface mapping completed for {target}. Review the scan results for detailed findings.",
        "summary": f"Scan completed for {target}",
        "affected_assets": [{"domain": target}],
        "metadata": {"target": target},
    }
    


class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.AI_BASE_URL, timeout=settings.AI_TIMEOUT)

    async def generate_executive_summary(self, job_id: UUID, target: str, results: Dict[str, Any]) -> Optional[AiInsight]:
        analysis = await analyze_scan_results(target, results)
        
        insight_data = {
            "type": InsightType.EXECUTIVE_SUMMARY,
            "priority": InsightPriority.CRITICAL if analysis.get("risk_score", 0) > 70 else InsightPriority.HIGH,
            "priority_score": analysis.get("risk_score", 50),
            "title": f"Executive Summary: {target}",
            "content": json.dumps(analysis.get("analysis", {}), indent=2),
            "summary": analysis.get("analysis", {}).get("executive_summary", "")[:500],
            "affected_assets": [{"target": target, "risk_score": analysis.get("risk_score")}],
            "model_used": analysis.get("model_used", settings.AI_MODEL),
            "tokens_used": analysis.get("tokens_used", 0),
            "confidence": min(analysis.get("risk_score", 50) / 100, 0.95) if analysis.get("risk_score") else 0.5,
            "is_actionable": True,
            "metadata": {"risk_score": analysis.get("risk_score")},
        }
        
        insight = AiInsight(
            scan_job_id=job_id,
            **insight_data,
        )
        
        self.db.add(insight)
        await self.db.commit()
        await self.db.refresh(insight)
        
        return insight

    async def get_job_insights(
        self,
        job_id: UUID,
        insight_type: Optional[InsightType] = None,
        limit: int = 50,
    ) -> List[AiInsight]:
        query = select(AiInsight).where(
            AiInsight.scan_job_id == job_id,
            AiInsight.is_dismissed == False,
        )
        
        if insight_type:
            query = query.where(AiInsight.insight_type == insight_type)
        
        query = query.order_by(AiInsight.priority_score.desc()).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())