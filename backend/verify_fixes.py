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


async def _check_subdomain_status(session):
    total_subdomains = await session.execute(select(func.count(Subdomain.id)))
    total = total_subdomains.scalar() or 0

    live_subdomains = await session.execute(select(func.count(Subdomain.id)).where(Subdomain.is_alive.is_(True)))
    live = live_subdomains.scalar() or 0

    dead_subdomains = await session.execute(select(func.count(Subdomain.id)).where(Subdomain.is_alive.is_(False)))
    dead = dead_subdomains.scalar() or 0

    null_subdomains = await session.execute(select(func.count(Subdomain.id)).where(Subdomain.is_alive.is_(None)))
    null = null_subdomains.scalar() or 0

    print(f"Total Subdomains: {total}")
    print(f"  {'✅' if total > 0 else ''} Live: {live}" + (f" ({live/total*100:.1f}%)" if total > 0 else ""))
    print(f"  {'❌' if total > 0 else ''} Dead: {dead}" + (f" ({dead/total*100:.1f}%)" if total > 0 else ""))
    print(f"  {'⚠️ ' if total > 0 else ''} Null: {null}" + (f" ({null/total*100:.1f}%)" if total > 0 else ""))

    if null > 0:
        print(f"\n⚠️  WARNING: {null} subdomains still have NULL status!")
        print("   Run: python fix_database_records.py")
    else:
        print("\n✅ All subdomains have explicit alive status")
    return null


async def _check_endpoint_sources(session):
    total_endpoints = await session.execute(select(func.count(Endpoint.id)))
    total_ep = total_endpoints.scalar() or 0
    print(f"Total Endpoints: {total_ep}")

    source_counts = await session.execute(
        select(Endpoint.source, func.count(Endpoint.id)).group_by(Endpoint.source)
    )

    has_enum_objects = False
    for source, count in source_counts.fetchall():
        source_str = str(source)
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
    return has_enum_objects


async def _check_scan_jobs(session):
    scans = await session.execute(select(ScanJob))
    all_scans = scans.scalars().all()
    print(f"Total Scans: {len(all_scans)}")
    for scan in all_scans[:5]:
        print(f"  * {scan.target_domain} - {scan.status.value}")
    if len(all_scans) > 5:
        print(f"  ... and {len(all_scans) - 5} more")


def _print_summary(issues):
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
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


async def verify_fixes():
    """Verify that all fixes have been applied"""
    print("=" * 60)
    print("RECONNY DATABASE VERIFICATION")
    print("=" * 60)

    async with async_session_factory() as session:
        print("\n📊 SUBDOMAIN STATUS CHECK")
        print("-" * 60)
        null = await _check_subdomain_status(session)

        print("\n📊 ENDPOINT SOURCE CHECK")
        print("-" * 60)
        has_enum_objects = await _check_endpoint_sources(session)

        print("\n📊 SCAN JOBS CHECK")
        print("-" * 60)
        await _check_scan_jobs(session)

        issues = []
        if null > 0:
            issues.append(f"❌ {null} subdomains with NULL status")
        if has_enum_objects:
            issues.append("❌ Endpoint sources contain enum objects")
        _print_summary(issues)


async def main():
    await verify_fixes()


if __name__ == "__main__":
    asyncio.run(main())
