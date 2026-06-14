import re
import pytest


DOMAIN_PATTERN = re.compile(
    r'^(?:[a-zA-Z0-9]'  
    r'(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+'  
    r'[a-zA-Z]{2,}$'  
)


def validate_domain(domain: str) -> bool:
    domain = domain.strip().lower()
    if not domain or len(domain) > 255:
        return False
    if domain.startswith(('http://', 'https://', '//')):
        return False
    return bool(DOMAIN_PATTERN.match(domain))


def sanitize_domain(domain: str) -> str:
    domain = domain.strip().lower()
    domain = domain.replace('http://', '').replace('https://', '').split('/')[0]
    return domain


class TestDomainValidation:
    def test_valid_domains(self):
        assert validate_domain("example.com")
        assert validate_domain("subdomain.example.com")
        assert validate_domain("my-domain.io")
        assert validate_domain("deeply.nested.subdomain.example.org")
        assert validate_domain("xn--bcher-kva.ch")

    def test_invalid_domains(self):
        assert not validate_domain("")
        assert not validate_domain("not-a-domain")
        assert not validate_domain("-starts-with-hyphen.com")
        assert not validate_domain("ends-with-hyphen-.com")
        assert not validate_domain("a" * 256)
        assert not validate_domain("http://example.com")
        assert not validate_domain("https://example.com/path")
        assert not validate_domain("//example.com")

    def test_sanitize_domain(self):
        assert sanitize_domain("https://example.com") == "example.com"
        assert sanitize_domain("http://sub.example.com/path?q=1") == "sub.example.com"
        assert sanitize_domain("  EXAMPLE.COM  ") == "example.com"
        assert sanitize_domain("example.com:8080") == "example.com:8080"


class TestSubdomainParsing:
    def test_extract_base_domain(self):
        from urllib.parse import urlparse
        
        domains = [
            "api.example.com",
            "sub.api.example.co.uk",
            "example.com",
        ]
        
        for domain in domains:
            parsed = urlparse(f"https://{domain}")
            assert parsed.hostname == domain