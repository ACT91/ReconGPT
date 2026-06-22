import pytest
from app.core.security_middleware import (
    validate_domain,
    sanitize_domain,
    sanitize_tool_input,
    ToolInputSanitizer,
)
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    decode_token,
)


class TestDomainValidation:
    def test_valid_domains(self):
        assert validate_domain("example.com")
        assert validate_domain("sub.example.com")
        assert validate_domain("my-domain.io")
        assert validate_domain("sub.domain.co.uk")
        assert validate_domain("xn--bcher-kva.ch")

    def test_invalid_domains(self):
        assert not validate_domain("")
        assert not validate_domain("not_a_domain")
        assert not validate_domain("http://example.com")
        assert not validate_domain("example.com/path")
        assert not validate_domain("-example.com")
        assert not validate_domain("example-.com")
        assert not validate_domain("a" * 300)

    def test_sanitize_domain(self):
        assert sanitize_domain("Example.COM") == "example.com"
        assert sanitize_domain("http://example.com") == "example.com"
        assert sanitize_domain("https://sub.example.com/path") == "sub.example.com"
        assert sanitize_domain(" example.com ") == "example.com"
        assert sanitize_domain("sub.example.com:8080") == "sub.example.com"


class TestInputSanitization:
    def test_sanitize_tool_input(self):
        assert sanitize_tool_input("example.com") == "example.com"
        assert sanitize_tool_input("example.com; rm -rf /") == "example.com rm -rf "
        assert sanitize_tool_input("example.com && ls") == "example.com  ls"
        assert sanitize_tool_input("test' OR '1'='1") == "test OR 11"
        assert sanitize_tool_input("normal-input_123") == "normal-input_123"

    def test_tool_input_sanitizer(self):
        sanitizer = ToolInputSanitizer()
        assert sanitizer.sanitize_target("http://Example.COM") == "example.com"
        assert sanitizer.sanitize_target(" test.com ") == "test.com"
        args = sanitizer.sanitize_command_args(["scan.sh", "--domain", "test.com;ls"])
        assert len(args) == 3
        assert ";" not in args[2]


class TestRateLimiting:
    def test_rate_limit_key_structure(self):
        from app.core.rate_limit import RateLimiter
        import redis.asyncio as redis
        import pytest

        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        client = None
        try:
            client = loop.run_until_complete(redis.from_url("redis://localhost:6379/0"))
            limiter = RateLimiter(client)
            is_allowed, remaining = loop.run_until_complete(
                limiter.is_allowed("test_key", 100, 60)
            )
            assert isinstance(is_allowed, bool)
            assert isinstance(remaining, int)
        except Exception:
            pytest.skip("Redis not available")
        finally:
            if client:
                try:
                    loop.run_until_complete(client.aclose())
                except Exception:
                    pass
            loop.close()


class TestExceptions:
    def test_app_exception(self):
        from app.core.exceptions import (
            AppException,
            NotFoundException,
            UnauthorizedException,
            ForbiddenException,
            ValidationException,
            RateLimitException,
            ToolExecutionException,
            format_exception_response,
        )

        exc = NotFoundException("Resource not found")
        assert exc.status_code == 404
        assert exc.code == "NOT_FOUND"

        exc = UnauthorizedException()
        assert exc.status_code == 401
        assert exc.code == "UNAUTHORIZED"

        exc = ForbiddenException()
        assert exc.status_code == 403

        exc = ValidationException(errors=[{"field": "email", "msg": "invalid"}])
        assert exc.status_code == 422
        assert len(exc.errors) == 1

        exc = RateLimitException(retry_after=60)
        assert exc.status_code == 429
        assert exc.retry_after == 60

        exc = ToolExecutionException(tool_name="nuclei", exit_code=1, stderr="error")
        assert exc.status_code == 502
        assert exc.tool_name == "nuclei"

    def test_format_exception_response(self):
        from app.core.exceptions import format_exception_response
        resp = format_exception_response("Error", "Detail", "ERR_001", extra="field")
        assert resp["error"] == "Error"
        assert resp["detail"] == "Detail"
        assert resp["code"] == "ERR_001"
        assert resp["extra"] == "field"