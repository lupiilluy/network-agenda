from __future__ import annotations

import argparse
import base64
import sys

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
except ImportError as exc:  # pragma: no cover - helper script
    raise SystemExit(
        "cryptography nao esta instalada. Rode `pip install -r backend/requirements.txt` antes de gerar as chaves VAPID."
    ) from exc


def to_base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera chaves VAPID para web push.")
    parser.add_argument(
        "--subject",
        default="mailto:voce@exemplo.com",
        help="Valor para WEB_PUSH_VAPID_SUBJECT. Ex.: mailto:voce@empresa.com",
    )
    args = parser.parse_args()

    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_der = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_numbers = public_key.public_numbers()
    public_uncompressed = b"\x04" + public_numbers.x.to_bytes(32, "big") + public_numbers.y.to_bytes(32, "big")

    print("Frontend (.env.local / Vercel)")
    print(f"VITE_WEB_PUSH_PUBLIC_KEY={to_base64url(public_uncompressed)}")
    print("")
    print("Backend (.env.local / Render)")
    print(f"WEB_PUSH_VAPID_PRIVATE_KEY={to_base64url(private_der)}")
    print(f"WEB_PUSH_VAPID_SUBJECT={args.subject}")
    print("")
    print("Formato gerado:")
    print("- chave publica: ponto EC nao compactado em base64url")
    print("- chave privada: PKCS8 DER em base64url, amigavel para variavel de ambiente")
    return 0


if __name__ == "__main__":  # pragma: no cover - helper script
    sys.exit(main())
