# Deploying Wine Tracker to the NurseStar VPS (wine.clearnuvo.com)

This runbook covers the hosted fork only. Upstream Home Assistant add-on
users can ignore it.

- Server: NurseStar VPS, 172.245.155.87, Ubuntu 22.04, no swap
- Public URL: https://wine.clearnuvo.com (Cloudflare proxied, Access in front,
  Full (strict) via a Configuration Rule on this hostname only)
- App: Docker container bound to 127.0.0.1:8096, 512 MB memory cap
- Code and state: /opt/nursestar/wine-tracker (git checkout + gitignored
  `.env`, `data/`, `secrets/`, `backups/`)
- Backups: restic to Cloudflare R2 bucket `wine-tracker-backups`, nightly

**Change blackout: no changes on this server on Fridays from 8 AM to 6 PM ET.**
That includes deploys, nginx reloads and timer edits. All commands below
assume a root shell (`sudo -i`).

Never paste secrets into a command line, chat, email, PR or commit. The
steps below read them with `read -rs`, which does not echo and does not
go into shell history.

---

## 0. Pre-checks (read only)

```bash
ss -ltnp | grep -E ':8096\b' && echo "PORT 8096 TAKEN, STOP" || echo "8096 free"
free -m; df -h /opt
docker --version; docker compose version
nginx -v; nginx -V 2>&1 | tr ' ' '\n' | grep -E 'realip|http_v2|ssl' || true
grep -n 'conf.d/\*.conf' /etc/nginx/nginx.conf
systemctl --version | head -1
systemd-analyze calendar '*-*-* 03:15:00 America/New_York'   # must parse
ls -l /etc/ssl/cloudflare/wine.clearnuvo.com.key
```

Stop if 8096 is taken, if `conf.d/*.conf` is not included in `http {}`, or
if `systemd-analyze` rejects the time zone form (then use the cron
alternative in section 6).

## 1. Code

```bash
git clone https://github.com/dishneggo/ha-wine-tracker.git /opt/nursestar/wine-tracker
cd /opt/nursestar/wine-tracker
git checkout <release-tag-or-commit>      # always deploy a reviewed commit on main
install -d -o 10001 -g 10001 -m 750 data
install -d -o root -g 10001 -m 750 secrets
install -d -o root -g root -m 700 backups
```

## 2. App secrets: /opt/nursestar/wine-tracker/.env (root:root 0600)

```bash
cd /opt/nursestar/wine-tracker
install -m 600 -o root -g root deploy/nursestar/env.example .env
```

Fill the non-secret values with an editor (`nano .env`), then append the
secrets without echoing them. Remove the empty placeholder lines for these
keys first (`sed -i '/^SECRET_KEY=$/d;/^ANTHROPIC_API_KEY=$/d' .env`).

```bash
# Session key, generated on the server, never displayed
printf 'SECRET_KEY=%s\n' "$(python3 -c 'import secrets; print(secrets.token_hex(32))')" >> .env

# Anthropic key: paste when prompted (nothing is shown)
read -rs -p 'Anthropic API key: ' K; echo
printf 'ANTHROPIC_API_KEY=%s\n' "$K" >> .env; unset K

chmod 600 .env; chown root:root .env
grep -c '^ANTHROPIC_API_KEY=sk-' .env    # prints 1, not the key
```

### App users: secrets/users.json (hashed, root:10001 0640)

The app refuses to start in `HOSTED_MODE` without at least one user. The
file holds werkzeug hashes only. Generate a hash with the image's own
Python (password is read with getpass and never shown):

```bash
cd /opt/nursestar/wine-tracker
docker compose -f deploy/nursestar/compose.yml build
docker run --rm -it --entrypoint python3 wine-tracker:nursestar hash_password.py
# prints pbkdf2:sha256:600000$...  (the hash, not the password)
```

Write the file (paste the hash when prompted; it is not echoed):

```bash
read -rs -p 'Hash: ' H; echo
python3 - "$H" > secrets/users.json <<'PY'
import json, sys
print(json.dumps({"diego": {"hash": sys.argv[1], "role": "admin"}}, indent=2))
PY
unset H
chown root:10001 secrets secrets/users.json
chmod 750 secrets; chmod 640 secrets/users.json
```

Add a read-only user by adding another entry with `"role": "readonly"`.

## 3. Build and start

```bash
cd /opt/nursestar/wine-tracker
docker compose -f deploy/nursestar/compose.yml up -d --build
docker compose -f deploy/nursestar/compose.yml ps
curl -fsS http://127.0.0.1:8096/healthz; echo          # ok
docker inspect wine-tracker --format '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.PidsLimit}} {{.Config.User}} {{.HostConfig.ReadonlyRootfs}}'
# expect: 536870912 536870912 200 10001:10001 true
```

With `CF_ACCESS_*` set, everything except `/healthz` answers 403 without a
valid Cloudflare Access token, which is expected when testing on the server:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8096/        # 403 (no Access JWT)
docker logs wine-tracker 2>&1 | grep 'Access check' | tail -1         # reason=missing
# The container must resolve and reach Cloudflare and Anthropic:
docker exec wine-tracker python3 -c "import jwt; print(len(jwt.PyJWKClient('https://empty-water-3d63.cloudflareaccess.com/cdn-cgi/access/certs').get_jwk_set().keys), 'Access keys')"
```

The build uses pip only (no Node). On the box used for testing it peaked
well under the free memory on this host, but watch `free -m` during the
first build.

## 4. TLS: Cloudflare Origin CA certificate

The private key was generated on the server at
`/etc/ssl/cloudflare/wine.clearnuvo.com.key`. The matching public
certificate is committed at `deploy/nursestar/tls/wine.clearnuvo.com.pem`
(SAN `wine.clearnuvo.com`, valid to 2041-10-14, SHA-256 fingerprint
`2A:DD:87:F7:C9:8F:99:D6:34:B8:59:E5:04:D9:4D:AE:FF:B9:0E:3E:E4:74:8B:24:4A:4C:22:21:C3:A9:E7:00`).

```bash
install -d -m 755 /etc/ssl/cloudflare
install -m 644 -o root -g root deploy/nursestar/tls/wine.clearnuvo.com.pem /etc/ssl/cloudflare/wine.clearnuvo.com.pem
chmod 600 /etc/ssl/cloudflare/wine.clearnuvo.com.key; chown root:root /etc/ssl/cloudflare/wine.clearnuvo.com.key

# Check that cert and key pair up WITHOUT printing the key: compare hashes
# of the public halves only.
c=$(openssl x509 -in /etc/ssl/cloudflare/wine.clearnuvo.com.pem -noout -pubkey | openssl pkey -pubin -outform DER | sha256sum | cut -d' ' -f1)
k=$(openssl pkey -in /etc/ssl/cloudflare/wine.clearnuvo.com.key -pubout -outform DER | sha256sum | cut -d' ' -f1)
[ "$c" = "$k" ] && echo "cert and key MATCH" || echo "MISMATCH, STOP"
# RSA modulus form of the same check:
[ "$(openssl x509 -noout -modulus -in /etc/ssl/cloudflare/wine.clearnuvo.com.pem | sha256sum)" = \
  "$(openssl rsa -noout -modulus -in /etc/ssl/cloudflare/wine.clearnuvo.com.key | sha256sum)" ] && echo "modulus MATCH"
```

No certbot run for this hostname. The origin certificate does not renew
(valid 15 years) and is only trusted by Cloudflare, so the DNS record must
stay proxied (orange cloud).

## 5. nginx (shared host: other vhosts must keep working)

```bash
cd /opt/nursestar/wine-tracker/deploy/nursestar
install -m 644 nginx/wine-tracker-http.conf /etc/nginx/conf.d/wine-tracker-http.conf
install -m 644 nginx/wine-proxy.conf        /etc/nginx/snippets/wine-proxy.conf
install -m 644 nginx/wine.clearnuvo.com.conf /etc/nginx/sites-available/wine.clearnuvo.com
RELOAD=0 sh ops/cf-ips.sh            # writes snippets/cloudflare-ips.conf and cloudflare-geo.conf
ln -sf /etc/nginx/sites-available/wine.clearnuvo.com /etc/nginx/sites-enabled/wine.clearnuvo.com
nginx -t && systemctl reload nginx
```

What the vhost does:
- Only Cloudflare peers are served (`geo $realip_remote_addr`); anything
  else gets 403. A host firewall rule is deliberately not used because
  other vhosts on 443 may not be behind Cloudflare.
- Real visitor IP from `CF-Connecting-IP`, used for rate limits
  (`/login` 5 per minute, `/api/` 120 per minute) and passed to the app as
  `X-Forwarded-For`.
- 20 MB upload cap, `/healthz` hidden (404), `X-Ingress-Path` blanked.

End-to-end check (after the DNS record and Access app exist): open
https://wine.clearnuvo.com in a private window. Cloudflare Access must ask
for the one-time PIN first; only then does the app login page appear.

Checks (from the server):

```bash
curl -sk -o /dev/null -w '%{http_code}\n' --resolve wine.clearnuvo.com:443:127.0.0.1 https://wine.clearnuvo.com/   # 403 (not from Cloudflare)
curl -s -o /dev/null -w '%{http_code}\n' https://survey.nursestarmedical.com/   # unchanged from before
curl -s -o /dev/null -w '%{http_code}\n' https://jorgetoken.com/                # unchanged from before
```

Cloudflare IP refresh (monthly, Sundays only):

```bash
install -m 644 systemd/wine-cf-ips.service systemd/wine-cf-ips.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now wine-cf-ips.timer
```

## 6. Backups to Cloudflare R2

Install restic. Ubuntu 22.04 ships restic 0.12.1; the scripts were tested
with the 0.12.1 release binary (local repository) and with 0.18.0.

```bash
apt-get install -y restic
```

Backup credentials live in a separate root-only file, not in the app's
`.env`, so the app container never sees them:

```bash
install -d -m 700 /root/.config
install -m 600 -o root -g root /opt/nursestar/wine-tracker/deploy/nursestar/backup.env.example /root/.config/wine-backup.env
sed -i '/^AWS_ACCESS_KEY_ID=$/d;/^AWS_SECRET_ACCESS_KEY=$/d;/^RESTIC_REPOSITORY=$/d;/^RESTIC_PASSWORD=$/d' /root/.config/wine-backup.env
cat >> /root/.config/wine-backup.env <<'X'
AWS_ACCESS_KEY_ID=dfd74cd4726c5579e0e498c8b61ad782
RESTIC_REPOSITORY=s3:https://2dd99fc3551ed050cea7ca722779dfba.r2.cloudflarestorage.com/wine-tracker-backups/restic
X
# R2 S3 secret access key (64 hex chars): paste when prompted
read -rs -p 'R2 secret access key: ' S; echo
printf 'AWS_SECRET_ACCESS_KEY=%s\n' "$S" >> /root/.config/wine-backup.env; unset S
# restic encryption password: generate, then copy it into Diego's password
# manager by reading it once from the file in a private terminal.
printf 'RESTIC_PASSWORD=%s\n' "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" >> /root/.config/wine-backup.env
chmod 600 /root/.config/wine-backup.env

# check credentials, then create the repository
set -a; . /root/.config/wine-backup.env; set +a
restic init
```

Note: R2 shows two different values when a token is created. restic needs
the **Secret Access Key** (64 hex characters), not the API token value.

First run, restore test, then timers:

```bash
/opt/nursestar/wine-tracker/deploy/nursestar/ops/backup.sh
/opt/nursestar/wine-tracker/deploy/nursestar/ops/restore-test.sh      # must end with "restore-test: ok"
cd /opt/nursestar/wine-tracker/deploy/nursestar
install -m 644 systemd/wine-backup.service systemd/wine-backup.timer systemd/wine-restore-test.service systemd/wine-restore-test.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now wine-backup.timer wine-restore-test.timer
systemctl list-timers 'wine-*'
```

Schedules: backup nightly 3:15 AM ET; restore test first Sunday of the
month 4:30 AM ET; Cloudflare IP refresh second Sunday 4:45 AM ET. None
falls in the Friday blackout. Retention: 14 daily, 8 weekly, 12 monthly.
Results: `journalctl -u wine-backup -u wine-restore-test --since -2d`.

Cron alternative if the time-zone form of `OnCalendar` is rejected: check
`timedatectl`, convert 3:15 AM ET to server time, and add to
`/etc/cron.d/wine-tracker`:

```
15 3 * * * root /opt/nursestar/wine-tracker/deploy/nursestar/ops/backup.sh >> /var/log/wine-backup.log 2>&1
```

## 7. Updates

```bash
cd /opt/nursestar/wine-tracker
/opt/nursestar/wine-tracker/deploy/nursestar/ops/backup.sh          # always back up first
git fetch origin && git checkout <new-tag-or-commit>
docker compose -f deploy/nursestar/compose.yml up -d --build
curl -fsS http://127.0.0.1:8096/healthz; echo
```

If nginx files changed in the release, re-run the `install` lines from
section 5, then `nginx -t && systemctl reload nginx`.

## 8. Rollback

| Problem | Commands |
|---|---|
| New release misbehaves | `git checkout <previous-tag>` then `docker compose -f deploy/nursestar/compose.yml up -d --build` |
| Data damaged by a release | `docker compose -f deploy/nursestar/compose.yml stop`; `cp backups/wine-<latest-before-deploy>.db data/wine-tracker/wine.db`; `chown 10001:10001 data/wine-tracker/wine.db`; `docker compose -f deploy/nursestar/compose.yml start` |
| Need data from R2 | `set -a; . /root/.config/wine-backup.env; set +a; restic snapshots; restic restore <id> --target /tmp/wine-restore`, then copy the DB and uploads back with the container stopped and `chown -R 10001:10001` |
| nginx change breaks anything | `rm /etc/nginx/sites-enabled/wine.clearnuvo.com /etc/nginx/conf.d/wine-tracker-http.conf && nginx -t && systemctl reload nginx` |
| Take the site offline now | Cloudflare: set the Access policy to block everyone or delete the DNS record (no server change). Server: `docker compose -f deploy/nursestar/compose.yml stop` |
| Leaked Anthropic key | Revoke in the Claude Console, replace the line in `.env` with the `read -rs` method, `docker compose -f deploy/nursestar/compose.yml up -d` |
| Leaked R2 credentials | Revoke the R2 token, create a new one, replace the line in `/root/.config/wine-backup.env` |
| Remove everything | `docker compose -f deploy/nursestar/compose.yml down`; remove the nginx files above and reload; `systemctl disable --now wine-backup.timer wine-restore-test.timer wine-cf-ips.timer` and delete the unit files; keep the R2 bucket until Diego decides |
