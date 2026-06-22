#!/usr/bin/env python3
"""
Fix script to update existing database records:
1. Set subdomain is_alive and status fields correctly based on live_hosts
2. Convert endpoint source enum values to string values
"""
import asyncio
import sys
from pathlib import Path
from urllib.parse import urlparse

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.job import ScanJob
from app.models.subdomain import Subdomain, SubdomainStatus
from app.models.endpoint import Endpoint, EndpointSource
from app.core.config import settings


async def fix_subdomain_status():
    """Fix subdomain is_alive and status fields"""
    print("Fixing subdomain status fields...")
    
    async with async_session_factory() as session:
        # Get all scan jobs
        result = await session.execute(select(ScanJob))
        jobs = result.scalars().all()
        
        total_fixed = 0
        for job in jobs:
            storage_path = Path(settings.STORAGE_PATH) / str(job.id)
            live_hosts_json = storage_path / "live_hosts.json"
            live_hosts_txt = storage_path / "live_hosts.txt"
            
            live_hosts_set = set()
            
            # Parse live hosts from JSON
            if live_hosts_json.exists() and live_hosts_json.stat().st_size > 0:
                import json
                with open(live_hosts_json) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            host = json.loads(line)
                            if not isinstance(host, dict):
                                continue
                            
                            url = host.get("url") or host.get("host") or host.get("input")
                            if not url:
                                continue
                            
                            name = urlparse(url).hostname if url.startswith("http") else url
                            if name:
                                live_hosts_set.add(name)
                        except json.JSONDecodeError:
                            continue
            
            # Parse live hosts from TXT
            elif live_hosts_txt.exists():
                with open(live_hosts_txt) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        name = urlparse(line).hostname if line.startswith("http") else line
                        live_hosts_set.add(name)
            
            # Update all subdomains for this job
            subdomains_result = await session.execute(
                select(Subdomain).where(Subdomain.scan_job_id == job.id)
            )
            subdomains = subdomains_result.scalars().all()
            
            for sd in subdomains:
                if sd.name in live_hosts_set:
                    if not sd.is_alive or sd.status != SubdomainStatus.ALIVE:
                        sd.is_alive = True
                        sd.status = SubdomainStatus.ALIVE
                        total_fixed += 1
                else:
                    if sd.is_alive or sd.status != SubdomainStatus.DEAD:
                        sd.is_alive = False
                        sd.status = SubdomainStatus.DEAD
                        total_fixed += 1
        
        await session.commit()
        print(f"Fixed {total_fixed} subdomain records")


async def fix_endpoint_sources():
    """Convert endpoint source enum objects to string values"""
    print("Fixing endpoint source fields...")
    
    async with async_session_factory() as session:
        result = await session.execute(select(Endpoint))
        endpoints = result.scalars().all()
        
        total_fixed = 0
        for ep in endpoints:
            if hasattr(ep.source, 'value'):
                # It's an enum, convert to string
                ep.source = ep.source.value
                total_fixed += 1
            elif ep.source and not isinstance(ep.source, str):
                # Convert to string representation
                ep.source = str(ep.source)
                total_fixed += 1
        
        await session.commit()
        print(f"Fixed {total_fixed} endpoint source records")


async def main():
    print("Starting database fix...")
    await fix_subdomain_status()
    await fix_endpoint_sources()
    print("Database fix completed!")


if __name__ == "__main__":
    asyncio.run(main())
