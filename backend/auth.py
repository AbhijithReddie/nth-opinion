"""
Who is calling: verify a Supabase access token ("Authorization: Bearer <token>").

Supabase signs access tokens with the project's signing keys (published at
{SUPABASE_URL}/auth/v1/.well-known/jwks.json, ES256 or RS256), or, in older projects,
with a shared secret (HS256, set SUPABASE_JWT_SECRET). We check the signature, expiry,
issuer ({SUPABASE_URL}/auth/v1) and audience ("authenticated"), and use the token's
`sub` as the user id. The client never gets to say who it is any other way.

The JWKS is fetched once and cached (PyJWKClient), and refetched for an unknown key id
when Supabase rotates keys. No Supabase secret or service_role key is ever needed.
"""

import logging
import os
import uuid
from dataclasses import dataclass

import jwt

logger = logging.getLogger("nth_opinion.auth")

AUDIENCE = "authenticated"
ASYMMETRIC = ("ES256", "RS256", "EdDSA")
LEEWAY_SECONDS = 30  # clock skew between Supabase and this server


class AuthError(Exception):
    """The token is missing, invalid or expired. `code` is "auth_required" or "session_expired"."""

    def __init__(self, message: str, code: str = "session_expired"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class User:
    id: str  # Supabase auth user id (uuid)
    email: str | None = None


class TokenVerifier:
    def __init__(self, supabase_url: str, jwt_secret: str | None = None, jwks_client=None):
        self.issuer = f"{supabase_url.rstrip('/')}/auth/v1"
        self.secret = jwt_secret or None
        # Anything with get_signing_key_from_jwt(token).key works (tests pass a fake).
        self.jwks = jwks_client or jwt.PyJWKClient(
            f"{self.issuer}/.well-known/jwks.json", cache_keys=True, lifespan=3600, timeout=10
        )

    def verify(self, token: str) -> User:
        try:
            alg = jwt.get_unverified_header(token).get("alg")
            # The algorithm decides where the key comes from, never the other way round:
            # HS256 only with our shared secret, asymmetric ones only from the JWKS.
            if alg == "HS256" and self.secret:
                key, algorithms = self.secret, ["HS256"]
            elif alg in ASYMMETRIC:
                key, algorithms = self.jwks.get_signing_key_from_jwt(token).key, [alg]
            else:
                raise AuthError("Unsupported sign-in token.")
            claims = jwt.decode(
                token,
                key,
                algorithms=algorithms,
                audience=AUDIENCE,
                issuer=self.issuer,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
            user_id = str(uuid.UUID(claims["sub"]))  # Supabase user ids are uuids
        except AuthError:
            raise
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Your session has expired. Please sign in again.") from exc
        except (jwt.PyJWTError, ValueError, KeyError) as exc:
            logger.info("Rejected a token: %s", type(exc).__name__)
            raise AuthError("Your sign-in couldn't be verified. Please sign in again.") from exc
        return User(id=user_id, email=claims.get("email"))


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
_verifier: TokenVerifier | None = None


def verifier() -> TokenVerifier | None:
    """The verifier for this deployment, or None if SUPABASE_URL isn't set."""
    global _verifier
    if _verifier is None and SUPABASE_URL:
        _verifier = TokenVerifier(SUPABASE_URL, os.getenv("SUPABASE_JWT_SECRET", "").strip() or None)
    return _verifier


def bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None
