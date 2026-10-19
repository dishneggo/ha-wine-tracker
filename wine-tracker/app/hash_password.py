"""Print a password hash for USERS_FILE without echoing the password.

Usage on the server (inside the running container, which has werkzeug):
    docker exec -it wine-tracker python3 hash_password.py

The password is read with getpass and never printed. Only the hash is
written to stdout, ready to paste into secrets/users.json.
"""
import getpass
import sys

from werkzeug.security import generate_password_hash


def main():
    pw = getpass.getpass("New password (min 12 chars): ")
    if len(pw) < 12:
        print("Password must be at least 12 characters.", file=sys.stderr)
        return 1
    if pw != getpass.getpass("Repeat password: "):
        print("Passwords do not match.", file=sys.stderr)
        return 1
    print(generate_password_hash(pw, method="pbkdf2:sha256:600000"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
