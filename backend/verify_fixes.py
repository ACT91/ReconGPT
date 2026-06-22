#!/usr/bin/env python3
"""
Verification script to check if database fixes were applied correctly
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select, func
from app.core.database import async_session_factory
from app.models.job import ScanJob
from app.models.subdomain import Subdomain, SubdomainStatus
from app.models.endpoint import Endpoint


async def verify_fixes():
    """Verify that all fixes have been applied"""
    print("=" * 60)
    print("RECONNY DATABASE VERIFICATION")
    print("=" * 60)
    
    async with async_session_factory() as session:
        # Check subdomain status
        print("\n📊 SUBDOMAIN STATUS CHECK")
        print("-" * 60)
        
        total_subdomains = await session.execute(
            select(func.count(Subdomain.id))
        )
        total = total_subdomains.scalar() or 0
        
        live_subdomains = await session.execute(
            select(func.count(Subdomain.id)).where(Subdomain.is_alive == True)
        )
        live = live_subdomains.scalar() or 0
        
        dead_subdomains = await session.execute(
            select(func.count(Subdomain.id)).where(Subdomain.is_alive == False)
        )
        dead = dead_subdomains.scalar() or 0
        
        null_subdomains = await session.execute(
            select(func.count(Subdomain.id)).where(Subdomain.is_alive.is_(None))
        )
        null = null_subdomains.scalar() or 0
        
        print(f"Total Subdomains: {total}")
        print(f"  ✅ Live: {live} ({live/total*100:.1f}%)" if total > 0 else "  ✅ Live: 0")
        print(f"  ❌ Dead: {dead} ({dead/total*100:.1f}%)" if total > 0 else "  ❌ Dead: 0")
        print(f"  ⚠️  Null: {null} ({null/total*100:.1f}%)" if total > 0 else "  ⚠️  Null: 0")
        
        if null > 0:
            print(f"\n⚠️  WARNING: {null} subdomains still have NULL status!")
            print("   Run: python fix_database_records.py")
        else:
            print("\n✅ All subdomains have explicit alive status")
        
        # Check endpoint sources
        print("\n📊 ENDPOINT SOURCE CHECK")
        print("-" * 60)
        
        total_endpoints = await session.execute(
            select(func.count(Endpoint.id))
        )
        total_ep = total_endpoints.scalar() or 0
        print(f"Total Endpoints: {total_ep}")
        
        # Check source distribution
        source_counts = await session.execute(
            select(Endpoint.source, func.count(Endpoint.id))
            .group_by(Endpoint.source)
        )
        
        has_enum_objects = False
        for source, count in source_counts.fetchall():
            source_str = str(source)
            # Check if it looks like an enum object representation
            if "EndpointSource." in source_str or not isinstance(source, str):
                has_enum_objects = True
                print(f"  ⚠️  {source_str}: {count} (ENUM OBJECT - NEEDS FIX)")
            else:
                print(f"  ✅ {source}: {count}")
        
        if has_enum_objects:
            print(f"\n⚠️  WARNING: Some endpoints have enum objects as source!")
            print("   Run: python fix_database_records.py")
        else:
            print("\n✅ All endpoints have string source values")
        
        # Check scans
        print("\n📊 SCAN JOBS CHECK")
        print("-" * 60)
        
        scans = await session.execute(select(ScanJob))
        all_scans = scans.scalars().all()
        
        print(f"Total Scans: {len(all_scans)}")
        for scan in all_scans[:5]:  # Show first 5
            print(f"  • {scan.target_domain} - {scan.status.value}")
        
        if len(all_scans) > 5:
            print(f"  ... and {len(all_scans) - 5} more")
        
        # Summary
        print("\n" + "=" * 60)
        print("VERIFICATION SUMMARY")
        print("=" * 60)
        
        issues = []
        if null > 0:
            issues.append(f"❌ {null} subdomains with NULL status")
        if has_enum_objects:
            issues.append("❌ Endpoint sources contain enum objects")
        
        if not issues:
            print("✅ ALL CHECKS PASSED!")
            print("\nYour database is healthy. The fixes have been applied.")
            print("\nNext steps:")
            print("  1. Restart your backend: uvicorn app.main:app --reload")
            print("  2. Restart your worker: celery -A app.tasks.celery_app worker")
            print("  3. Check the UI to verify everything works")
        else:
            print("⚠️  ISSUES FOUND:")
            for issue in issues:
                print(f"  {issue}")
            print("\nPlease run: python fix_database_records.py")
        
        print("=" * 60)


async def main():
    await verify_fixes()


if __name__ == "__main__":
    asyncio.run(main())
