import sys
sys.path.insert(0, '/app')
from sqlalchemy import create_engine, text, MetaData, Table
from app.core.config import settings

e = create_engine(str(settings.DATABASE_URL))
c = e.connect()

metadata = MetaData()
metadata.reflect(bind=e)
ALLOWED_TABLES = {
    'ai_insights', 'pipeline_logs', 'vulnerabilities',
    'endpoints', 'js_files', 'subdomains', 'scan_jobs',
}

tables_to_delete = [t for t in ALLOWED_TABLES if t in metadata.tables]
for t in tables_to_delete:
    table = Table(t, metadata, autoload_with=e)
    stmt = table.delete()
    r = c.execute(stmt)
    print(f'{t}: {r.rowcount} rows deleted')

c.commit()
print('All scan data cleared.')
