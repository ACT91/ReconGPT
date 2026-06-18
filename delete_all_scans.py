import sys
sys.path.insert(0, '/app')
from sqlalchemy import create_engine, text
from app.core.config import settings

e = create_engine(str(settings.DATABASE_URL))
c = e.connect()

tables = [
    'ai_insights',
    'pipeline_logs',
    'vulnerabilities',
    'endpoints',
    'js_files',
    'subdomains',
    'scan_jobs',
]

for t in tables:
    r = c.execute(text(f'DELETE FROM {t}'))
    print(f'{t}: {r.rowcount} rows deleted')

c.commit()
print('All scan data cleared.')
